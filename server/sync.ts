import { and, eq, inArray, isNull } from "drizzle-orm";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../shared/constants";
import type {
  FetchedItem,
  ItemDetail,
  MergeableState,
  SyncResult,
  SyncStats,
} from "../shared/types";
import { db } from "./db";
import { itemDetails, items, sources } from "./db/schema";
import {
  fetchByNodeIds,
  fetchDetails,
  fetchSourceUpdatedSince,
  scopeOf,
} from "./github/fetch";
import { readSettings } from "./settings";

let syncing = false;

/** The amount of overlap we fetch from the last seen repo update */
const REPO_OVERLAP_MS = MINUTE_MS;
/** The amount of overlap we fetch from the last seen owner update. This is wider than the repo
 * overlap because the REST search index is eventually consistent
 */
const OWNER_OVERLAP_MS = 15 * MINUTE_MS;

const DEEP_RESYNC_EVERY_MS = HOUR_MS;
const DEEP_LOOKBACK_MS = DAY_MS;
const MANUAL_LOOKBACK_MS = 2 * HOUR_MS;

/** How many existing items missing content will be fetched per run */
const DETAIL_BACKFILL_LIMIT = 200;

/** How many of your open pull requests get re-read for silent changes per run */
const MINE_REFRESH_LIMIT = 200;

const lastDeepSyncAt = new Map<number, number>();

const upsertDetails = (details: ItemDetail[]) => {
  for (const detail of details) {
    db.insert(itemDetails)
      .values(detail)
      .onConflictDoUpdate({ target: itemDetails.itemId, set: { ...detail, itemId: undefined } })
      .run();
  }
};

interface MergeState {
  mergeable: MergeableState | null;
  conflictedSince: string | null;
}

/**
 * A conflict is not an event: GitHub never says when one appeared, and it does not move the pull
 * request's updatedAt. All we can do is compare against the mergeability we stored last time and
 * stamp the transition if we witnessed it
 */
export const reconcileConflict = (
  previous: MergeState | undefined,
  incoming: MergeableState | null,
  at: string,
): MergeState => {
  // An issue, or a pull request cached before we started asking for mergeability
  if (incoming === null) {
    return previous ?? { mergeable: null, conflictedSince: null };
  }

  // GitHub computes mergeability lazily, so the first read of a pull request usually answers
  // UNKNOWN while it works. That is no news, not "no longer conflicting"
  if (incoming === "UNKNOWN") {
    return {
      mergeable: previous?.mergeable ?? "UNKNOWN",
      conflictedSince: previous?.conflictedSince ?? null,
    };
  }

  if (incoming !== "CONFLICTING") {
    return { mergeable: incoming, conflictedSince: null };
  }

  // Keep the original stamp, so a long-standing conflict does not look fresh on every sync
  if (previous?.conflictedSince) {
    return { mergeable: incoming, conflictedSince: previous.conflictedSince };
  }

  // Conflicting the first time we looked, or the first time we could tell: the flip happened
  // outside our view, so we cannot honestly date it, let alone call it activity
  const witnessed = previous?.mergeable === "MERGEABLE";

  return { mergeable: incoming, conflictedSince: witnessed ? at : null };
};

/**
 * Write a single chunk of fetched GitHub data
 */
const writePage = (fetched: FetchedItem[], details: ItemDetail[]) =>
  db.transaction((tx) => {
    const pullRequestIds = fetched.flatMap((item) => (item.type === "pr" ? [item.id] : []));
    const stored = new Map<string, MergeState>(
      (pullRequestIds.length === 0
        ? []
        : tx
            .select({
              id: items.id,
              mergeable: items.mergeable,
              conflictedSince: items.conflictedSince,
            })
            .from(items)
            .where(inArray(items.id, pullRequestIds))
            .all()
      ).map((row) => [row.id, { mergeable: row.mergeable, conflictedSince: row.conflictedSince }]),
    );
    const at = new Date().toISOString();

    for (const fresh of fetched) {
      const item = {
        ...fresh,
        ...reconcileConflict(stored.get(fresh.id), fresh.mergeable, at),
      };

      tx.insert(items)
        .values(item)
        .onConflictDoUpdate({ target: items.id, set: { ...item, id: undefined } })
        .run();
    }

    for (const detail of details) {
      tx.insert(itemDetails)
        .values(detail)
        .onConflictDoUpdate({ target: itemDetails.itemId, set: { ...detail, itemId: undefined } })
        .run();
    }
  });

/**
 * Items cached before we started storing content have no detail row, and a preview can't show
 * anything for them. Backfill that content
 */
const backfillDetails = async (): Promise<number> => {
  const missing = db
    .select({ id: items.id })
    .from(items)
    .leftJoin(itemDetails, eq(itemDetails.itemId, items.id))
    .where(isNull(itemDetails.itemId))
    .limit(DETAIL_BACKFILL_LIMIT)
    .all();

  if (missing.length === 0) {
    return 0;
  }

  const details = await fetchDetails(missing.map((row) => row.id));
  upsertDetails(details);

  return details.length;
};

/**
 * A pull request that starts conflicting produces no event and no updatedAt change, so the
 * updated-since sync will never look at it again. Poll the ones you own directly instead
 */
const syncMine = async (): Promise<SyncStats | undefined> => {
  const { me } = readSettings();

  if (!me) {
    return undefined;
  }

  const mine = db
    .select({ id: items.id, sourceId: items.sourceId })
    .from(items)
    .where(and(eq(items.type, "pr"), eq(items.state, "OPEN"), eq(items.author, me)))
    .limit(MINE_REFRESH_LIMIT)
    .all();

  if (mine.length === 0) {
    return undefined;
  }

  const sourceById = new Map(mine.map((row) => [row.id, row.sourceId]));
  const result = await fetchByNodeIds(
    mine.map((row) => row.id),
    (id) => sourceById.get(id) ?? 0,
    writePage,
  );

  console.log(`[sync] author:${me}: re-read ${result.written} open pull requests`);

  return {
    // The pass spans every source, so it belongs to none of them
    sourceId: 0,
    scope: `author:${me}`,
    upserted: result.written,
    pages: result.pages,
    rateLimitRemaining: result.rateLimitRemaining,
  };
};

export const syncSource = async (
  source: typeof sources.$inferSelect,
  manual = false,
): Promise<SyncStats> => {
  const now = Date.now();
  const startedAt = new Date(now).toISOString();

  let sinceMs: number;
  let deep = false;

  if (!source.lastSyncedAt) {
    sinceMs = now - source.backfillDays * DAY_MS;
  } else {
    const overlap = source.kind === "repo" ? REPO_OVERLAP_MS : OWNER_OVERLAP_MS;
    sinceMs = new Date(source.lastSyncedAt).getTime() - overlap;

    if (manual) {
      sinceMs = Math.min(sinceMs, now - MANUAL_LOOKBACK_MS);
    }

    if (now - (lastDeepSyncAt.get(source.id) ?? 0) >= DEEP_RESYNC_EVERY_MS) {
      sinceMs = Math.min(sinceMs, now - DEEP_LOOKBACK_MS);
      deep = true;
    }
  }

  const since = new Date(sinceMs).toISOString();
  const scope = scopeOf(source);
  let written = 0;

  const stats = await fetchSourceUpdatedSince(
    source,
    since,
    (fetched, details) => {
      writePage(fetched, details);
      written += fetched.length;
    },
    (count) => console.log(`  [sync] ${scope}: ${count} items so far`),
  ).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`${message} (kept ${written} items fetched before it failed)`);
  });

  db.update(sources).set({ lastSyncedAt: startedAt }).where(eq(sources.id, source.id)).run();

  if (deep) {
    lastDeepSyncAt.set(source.id, now);
  }

  console.log(`[sync] ${stats.scope}: upserted ${stats.upserted} (${stats.pages} pages)`);

  return stats;
};

/**
* Spawn a sequential sync
*/
export const syncAll = async (manual = false): Promise<SyncResult> => {
  if (syncing) {
    return { ran: false, stats: [], errors: ["sync already in progress"] };
  }

  syncing = true;
  const stats: SyncStats[] = [];
  const errors: string[] = [];

  try {
    for (const source of db.select().from(sources).all()) {
      try {
        stats.push(await syncSource(source, manual));
      } catch (error) {
        const scope = `${source.kind}:${source.owner}${source.repo ? `/${source.repo}` : ""}`;
        const message = `${scope}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[sync] FAILED ${message}`);
        errors.push(message);
      }
    }

    try {
      const mineStats = await syncMine();

      if (mineStats) {
        stats.push(mineStats);
      }
    } catch (error) {
      errors.push(`own pull requests: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const filled = await backfillDetails();

      if (filled > 0) {
        console.log(`[sync] backfilled content for ${filled} items`);
      }
    } catch (error) {
      errors.push(`detail backfill: ${error instanceof Error ? error.message : String(error)}`);
    }
  } finally {
    syncing = false;
  }

  return { ran: true, stats, errors };
};
