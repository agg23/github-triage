import { HOUR_MS } from "../shared/constants";
import type { Item, ItemState } from "../shared/types";
import { CONFIG } from "./config";
import type { ActorClass, BucketId, ForMeReason, TriageItem } from "./types";

const normalizeLogin = (login: string) => login.toLowerCase();

const TEAM_LOGINS = new Set(CONFIG.teamMembers.map(normalizeLogin));
const TRUSTED_LOGINS = new Set(CONFIG.trustedContributors.map(normalizeLogin));
const BOT_LOGINS = new Set(CONFIG.bots.map(normalizeLogin));

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / HOUR_MS;

export const classify = (login: string | undefined, typename?: string): ActorClass => {
  const normalized = normalizeLogin(login ?? "");

  if (!normalized) {
    return "external";
  }

  if (typename === "Bot" || normalized.endsWith("[bot]") || BOT_LOGINS.has(normalized)) {
    return "bot";
  }

  if (TEAM_LOGINS.has(normalized)) {
    return "team";
  }

  if (TRUSTED_LOGINS.has(normalized)) {
    return "trusted";
  }

  return "external";
};

export const bucketOf = (
  item: Pick<TriageItem, "type" | "authorClass" | "lastActorClass" | "author" | "lastActor">,
): BucketId => {
  if (item.type === "pr" && item.authorClass === "team") {
    if (CONFIG.me && item.author === CONFIG.me) {
      return item.lastActor === CONFIG.me ? "waiting" : "attention";
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
  snoozeByItem: Map<string, ItemState>,
): TriageItem => {
  const authorClass = classify(item.author, item.authorType);
  const lastActorClass = classify(item.lastActor, item.lastActorType);
  const partial = {
    ...item,
    authorClass,
    lastActorClass,
    priority: priorityBySource.get(item.sourceId) ?? 0,
  };
  const me = CONFIG.me;

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

  return {
    ...partial,
    bucket: bucketOf(partial),
    isNew: hoursSince(item.createdAt) <= CONFIG.newWithinHours,
    teamReviewed: item.reviewers.some((reviewer) => classify(reviewer) === "team"),
    forMeReasons,
    forMe: forMeReasons.length > 0,
    snooze: snoozeByItem.get(item.id),
    mutedBy: undefined,
  };
};
