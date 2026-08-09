import { eq, isNull } from "drizzle-orm";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../shared/constants";
import type { Item, ItemDetail, SyncResult, SyncStats } from "../shared/types";
import { db } from "./db";
import { itemDetails, items, sources } from "./db/schema";
import { fetchDetails, fetchSourceUpdatedSince, scopeOf } from "./github/fetch";

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

const lastDeepSyncAt = new Map<number, number>();

const upsertDetails = (details: ItemDetail[]) => {
  for (const detail of details) {
    db.insert(itemDetails)
      .values(detail)
      .onConflictDoUpdate({ target: itemDetails.itemId, set: { ...detail, itemId: undefined } })
      .run();
  }
};

/**
 * Write a single chunk of fetched GitHub data
 */
const writePage = (fetched: Item[], details: ItemDetail[]) =>
  db.transaction((tx) => {
    for (const item of fetched) {
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
