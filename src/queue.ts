import { evaluateItem, parseRuleQuery } from "../shared/query";
import {
  BUCKET_ORDER,
  type BucketId,
  type FilterOptions,
  type Filters,
  type SortId,
  type TriageItem,
} from "./types";

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values)].sort((first, second) => first.localeCompare(second));

export const filterOptionsFor = (items: TriageItem[]): FilterOptions => ({
  repos: uniqueSorted(items.map((item) => item.repo)),
  labels: uniqueSorted(items.flatMap((item) => item.labels.map((label) => label.name))),
  authors: uniqueSorted(items.map((item) => item.author)),
  assignees: uniqueSorted(items.flatMap((item) => item.assignees)),
  people: uniqueSorted(items.flatMap((item) => [item.author, item.lastActor, ...item.assignees])),
});

export interface QueueRows {
  visible: TriageItem[];
  shownCount: number;
  mutedTotal: number;
}

export const applyRules = (
  items: TriageItem[],
  filters: Filters,
  hideMuted: boolean,
): QueueRows => {
  const ruleQuery = parseRuleQuery(filters.query);
  const passesToggles = (item: TriageItem) =>
    !(filters.hideBots && item.lastActorClass === "bot") &&
    !(filters.hideDrafts && item.isDraft) &&
    !(filters.forMe && !item.forMe);

  const visible: TriageItem[] = [];
  let shownCount = 0;
  let mutedTotal = 0;

  for (const item of items) {
    if (!passesToggles(item)) {
      continue;
    }

    const { action, rule } = evaluateItem(ruleQuery, item);

    if (action === "hide") {
      continue;
    }

    if (action === "mute") {
      mutedTotal += 1;

      if (!hideMuted) {
        visible.push({ ...item, mutedBy: rule });
      }

      continue;
    }

    shownCount += 1;
    visible.push(item);
  }

  return { visible, shownCount, mutedTotal };
};

export const comparatorFor =
  (sort: SortId) =>
  (first: TriageItem, second: TriageItem): number => {
    if (sort === "priority" && first.priority !== second.priority) {
      return second.priority - first.priority;
    } else if (sort === "created") {
      return second.createdAt.localeCompare(first.createdAt);
    } else {
      return second.activityAt.localeCompare(first.activityAt);
    }
  };

export const groupByBucket = (
  visible: TriageItem[],
  sort: SortId,
): Map<BucketId, TriageItem[]> => {
  const byBucket = new Map<BucketId, TriageItem[]>();

  for (const bucketId of BUCKET_ORDER) {
    byBucket.set(bucketId, []);
  }

  for (const item of visible) {
    byBucket.get(item.bucket)?.push(item);

    // New is a subset of Requires attention, so fresh items show in both
    if (item.bucket === "attention" && item.isNew) {
      byBucket.get("new")?.push(item);
    }

    // Flagging shows in all of the buckets
    if (item.bucket !== "attention" && item.flaggedAt) {
      byBucket.get("attention")?.push(item);
    }
  }

  const compare = comparatorFor(sort);

  for (const list of byBucket.values()) {
    list.sort(compare);
  }

  return byBucket;
};
