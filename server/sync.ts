import { eq } from "drizzle-orm";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../shared/constants";
import type { SyncResult, SyncStats } from "../shared/types";
import { db } from "./db";
import { items, sources } from "./db/schema";
import { fetchSourceUpdatedSince } from "./github/fetch";

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

const lastDeepSyncAt = new Map<number, number>();

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
  const scope =
    source.kind === "repo" ? `${source.owner}/${source.repo}` : `${source.kind}:${source.owner}`;
  const { items: fetched, ...stats } = await fetchSourceUpdatedSince(source, since, (count) =>
    console.log(`  [sync] ${scope}: ${count} items so far`),
  );

  for (const item of fetched) {
    db.insert(items)
      .values(item)
      .onConflictDoUpdate({ target: items.id, set: { ...item, id: undefined } })
      .run();
  }

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
  } finally {
    syncing = false;
  }

  return { ran: true, stats, errors };
};
