import { HOUR_MS } from "../shared/constants";
import type { Item, ItemState } from "../shared/types";
import { getLookups, getSettings } from "./settings";
import type { ActorClass, BucketId, ForMeReason, TriageItem } from "./types";

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / HOUR_MS;

export const classify = (login: string | undefined, typename?: string): ActorClass => {
  const normalized = (login ?? "").toLowerCase();
  const { team, trusted, bots } = getLookups();

  if (!normalized) {
    return "external";
  }

  if (typename === "Bot" || normalized.endsWith("[bot]") || bots.has(normalized)) {
    return "bot";
  }

  if (team.has(normalized)) {
    return "team";
  }

  if (trusted.has(normalized)) {
    return "trusted";
  }

  return "external";
};

export const bucketOf = (
  item: Pick<TriageItem, "type" | "authorClass" | "lastActorClass" | "author" | "lastActor">,
): BucketId => {
  const { me } = getSettings();

  if (item.type === "pr" && item.authorClass === "team") {
    if (me && item.author === me) {
      return item.lastActor === me ? "waiting" : "attention";
    }

    if (item.lastActorClass === "team" && item.lastActor !== item.author) {
      return "waiting";
    }

    return "attention";
  }

  switch (item.lastActorClass) {
    case "bot":
      return "bot";
    case "team":
      // We replied to someone else's item, so we're waiting on them
      return "waiting";
    default:
      return "attention";
  }
};

export const enrich = (
  item: Item,
  priorityBySource: Map<number, number>,
  stateByItem: Map<string, ItemState>,
): TriageItem => {
  const { me, newWithinHours } = getSettings();
  const authorClass = classify(item.author, item.authorType);
  const lastActorClass = classify(item.lastActor, item.lastActorType);
  const partial = {
    ...item,
    authorClass,
    lastActorClass,
    priority: priorityBySource.get(item.sourceId) ?? 0,
  };

  const forMeReasons: ForMeReason[] = [];

  if (me && item.lastActor !== me) {
    if (item.author === me) {
      forMeReasons.push("yours");
    }

    if (item.reviewRequests.includes(me)) {
      forMeReasons.push("review requested");
    }

    if (item.assignees.includes(me)) {
      forMeReasons.push("assigned");
    }

    if (item.author !== me && (item.participants.includes(me) || item.reviewers.includes(me))) {
      forMeReasons.push("involved");
    }
  }

  const state = stateByItem.get(item.id);
  const asleep = state?.wakeAt || state?.wakeOnActivityAfter;

  return {
    ...partial,
    bucket: bucketOf(partial),
    isNew: hoursSince(item.createdAt) <= newWithinHours,
    teamReviewed: item.reviewers.some((reviewer) => classify(reviewer) === "team"),
    forMeReasons,
    forMe: forMeReasons.length > 0,
    snooze: asleep ? state : undefined,
    flaggedAt: state?.flaggedAt ?? undefined,
    mutedBy: undefined,
  };
};
