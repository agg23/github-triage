import { DAY_MS } from "../shared/constants";
import type { ItemType } from "../shared/types";
import type { ActorClass } from "./types";

export interface StatItem {
  type: ItemType;
  createdAt: string;
  authorClass: ActorClass;
}

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  issue: "Issues",
  pr: "Pull requests",
};

export type Scope = "all" | ItemType;

export const SCOPES: Scope[] = ["all", "issue", "pr"];

export const scopeLabel = (scope: Scope): string =>
  scope === "all" ? "All opened" : ITEM_TYPE_LABEL[scope];

export const typesForScope = (scope: Scope): ItemType[] =>
  scope === "all" ? ["issue", "pr"] : [scope];

const CLASS_VAR: Record<ActorClass, string> = {
  external: "--cls-external",
  team: "--cls-team",
  trusted: "--cls-trusted",
  bot: "--cls-bot",
};

export const classColor = (actorClass: ActorClass) => `var(${CLASS_VAR[actorClass]})`;

export const TYPE_COLOR: Record<ItemType, string> = {
  issue: "var(--cls-team)",
  pr: "var(--cls-trusted)",
};

export const CONTRIB_CLASSES: ActorClass[] = ["external", "team", "trusted"];

export const CLASS_LABEL: Record<ActorClass, string> = {
  external: "External",
  team: "Team",
  trusted: "Trusted",
  bot: "Bots",
};

export type Granularity = "week" | "month";

export const PRESETS = [
  { id: "4w", label: "Last 4 weeks", days: 28, granularity: "week" },
  { id: "12w", label: "Last 12 weeks", days: 84, granularity: "week" },
  { id: "6m", label: "Last 6 months", days: 183, granularity: "month" },
  { id: "12m", label: "Last 12 months", days: 365, granularity: "month" },
  { id: "24m", label: "Last 2 years", days: 730, granularity: "month" },
] as const;

export type PresetId = (typeof PRESETS)[number]["id"];

export const PRESET_IDS = PRESETS.map((preset) => preset.id);

export const DEFAULT_PRESET_ID: PresetId = "12w";

export type ClassCounts = Record<ActorClass, number>;

export interface Bucket {
  key: string;
  label: string;
  start: number;
  end: number;
  byType: Record<ItemType, ClassCounts>;
  openByType?: Record<ItemType, number>;
}

const emptyCounts = (): ClassCounts => ({ team: 0, trusted: 0, external: 0, bot: 0 });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfWeek = (time: number): number => {
  const date = new Date(time);
  // 0 is Monday
  const weekday = (date.getUTCDay() + 6) % 7;

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - weekday);
};

const startOfMonth = (time: number): number => {
  const date = new Date(time);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};

const addMonths = (time: number, count: number): number => {
  const date = new Date(time);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1);
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const buildBuckets = (rangeStart: number, now: number, granularity: Granularity): Bucket[] => {
  const buckets: Bucket[] = [];

  if (granularity === "week") {
    for (let start = startOfWeek(rangeStart); start <= now; start += 7 * DAY_MS) {
      const date = new Date(start);

      buckets.push({
        key: `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`,
        label: `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`,
        start,
        end: start + 7 * DAY_MS,
        byType: { issue: emptyCounts(), pr: emptyCounts() },
      });
    }

    return buckets;
  }

  for (let start = startOfMonth(rangeStart); start <= now; start = addMonths(start, 1)) {
    const date = new Date(start);

    buckets.push({
      key: `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`,
      label: `${MONTHS[date.getUTCMonth()]} '${String(date.getUTCFullYear()).slice(2)}`,
      start,
      end: addMonths(start, 1),
      byType: { issue: emptyCounts(), pr: emptyCounts() },
    });
  }

  return buckets;
};

export interface StatsResult {
  buckets: Bucket[];
  granularity: Granularity;
}

export const aggregate = (
  items: StatItem[],
  rangeStart: number,
  now: number,
  granularity: Granularity,
): StatsResult => {
  const buckets = buildBuckets(rangeStart, now, granularity);

  for (const item of items) {
    const created = new Date(item.createdAt).getTime();

    if (created < buckets[0].start || created >= now) {
      continue;
    }

    const bucket = buckets.find(
      (candidate) => created >= candidate.start && created < candidate.end,
    );

    if (!bucket) {
      continue;
    }

    bucket.byType[item.type][item.authorClass] += 1;
  }

  return { buckets, granularity };
};

export const bucketClassTotal = (
  bucket: Bucket,
  types: ItemType[],
  actorClass: ActorClass,
): number => types.reduce((sum, type) => sum + bucket.byType[type][actorClass], 0);
