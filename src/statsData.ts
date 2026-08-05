import { DAY_MS, SECOND_MS } from "../shared/constants";
import type { ItemType } from "../shared/types";
import { aggregate, type Granularity, type StatItem, type StatsResult } from "./stats";
import { classify } from "./triage";

export type StatMetric = "opened" | "open";

export interface StatsQuery {
  label: string | undefined;
  metric: StatMetric;
}

export interface StatsResponse {
  stats: StatsResult;
  metric: StatMetric;
  coveredSince: string | undefined;
}

interface StatsRow {
  type: ItemType;
  createdAt: string;
  closedAt: string | null;
  author: string;
  authorType: string;
  labels: string[];
}

interface SourceRow {
  createdAt: string;
  backfillDays: number;
}

interface RowsCache {
  rows: StatsRow[];
  coveredSince: string | undefined;
  at: number;
}

const CACHE_TTL_MS = 30 * SECOND_MS;

let rowsCache: RowsCache | undefined = undefined;

const loadRows = async (): Promise<RowsCache> => {
  if (rowsCache && Date.now() - rowsCache.at < CACHE_TTL_MS) {
    return rowsCache;
  }

  const [rowsResponse, sourcesResponse] = await Promise.all([
    fetch("/api/stats-items"),
    fetch("/api/sources"),
  ]);

  if (!rowsResponse.ok) {
    throw new Error(`stats fetch failed: ${rowsResponse.status}`);
  }

  const rows = (await rowsResponse.json()) as StatsRow[];
  const sources = sourcesResponse.ok ? ((await sourcesResponse.json()) as SourceRow[]) : [];

  const floors = sources.map(
    (source) => new Date(source.createdAt).getTime() - source.backfillDays * DAY_MS,
  );
  const coveredSince = floors.length ? new Date(Math.max(...floors)).toISOString() : undefined;

  rowsCache = { rows, coveredSince, at: Date.now() };

  return rowsCache;
};

export const fetchRepoLabels = async (): Promise<string[]> => {
  const { rows } = await loadRows();

  return [...new Set(rows.flatMap((row) => row.labels))].sort((a, b) => a.localeCompare(b));
};

export const fetchStats = async (
  fromMs: number,
  now: number,
  granularity: Granularity,
  { label, metric }: StatsQuery,
): Promise<StatsResponse> => {
  const { rows, coveredSince } = await loadRows();
  const filtered = label ? rows.filter((row) => row.labels.includes(label)) : rows;

  const statItems: StatItem[] = filtered.map((row) => ({
    type: row.type,
    createdAt: row.createdAt,
    authorClass: classify(row.author, row.authorType),
  }));
  const stats = aggregate(statItems, fromMs, now, granularity);

  if (metric === "open") {
    // Merged PRs carry closedAt, so they count as closed
    for (const bucket of stats.buckets) {
      const end = Math.min(bucket.end, now);
      const openByType: Record<ItemType, number> = { issue: 0, pr: 0 };

      for (const row of filtered) {
        if (new Date(row.createdAt).getTime() > end) {
          continue;
        }

        const closed = row.closedAt ? new Date(row.closedAt).getTime() : undefined;

        if (closed !== undefined && closed <= end) {
          continue;
        }

        openByType[row.type] += 1;
      }

      bucket.openByType = openByType;
    }
  }

  const windowCovered = coveredSince === undefined || fromMs >= new Date(coveredSince).getTime();

  return {
    stats,
    metric,
    coveredSince: windowCovered ? undefined : coveredSince,
  };
};

export const invalidateStats = () => {
  rowsCache = undefined;
};
