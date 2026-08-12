import type { Item, ItemState } from "../shared/types";

export type ActorClass = "team" | "trusted" | "external" | "bot";

export const BUCKET_ORDER = ["attention", "new", "waiting", "bot"] as const;
export type BucketId = (typeof BUCKET_ORDER)[number];

export type QueueTab = BucketId | "flagged" | "snoozed";

export type ForMeReason = "yours" | "review requested" | "assigned" | "involved";

export type SortId = "recent" | "created" | "priority";

export interface Filters {
  query: string;
  hideBots: boolean;
  hideDrafts: boolean;
  forMe: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  hideBots: true,
  hideDrafts: false,
  forMe: false,
};

export interface FilterOptions {
  repos: string[];
  labels: string[];
  authors: string[];
  assignees: string[];
  people: string[];
}

export interface SnoozeChoice {
  wakeAt: string | undefined;
  wakeOnActivity: boolean;
}

export interface TriageItem extends Item {
  authorClass: ActorClass;
  lastActorClass: ActorClass;
  bucket: BucketId;
  isNew: boolean;
  teamReviewed: boolean;
  forMeReasons: ForMeReason[];
  forMe: boolean;
  priority: number;
  snooze: ItemState | undefined;
  flaggedAt: string | undefined;
  mutedBy: string | undefined;
}
