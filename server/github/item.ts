import type { ActionKind, Item, ItemGitHubState } from "../../shared/types";
import type { Actor, RawNode } from "./schema";

interface ItemEvent {
  actor: Actor | null;
  at: string;
  kind: ActionKind;
}

const isBot = (actor: Actor | null) =>
  actor?.__typename === "Bot" || (actor?.login ?? "").endsWith("[bot]");

const eventsOf = (node: RawNode): ItemEvent[] => {
  const events: ItemEvent[] = [{ actor: node.author, at: node.createdAt, kind: "opened" }];

  for (const comment of node.comments.nodes) {
    events.push({ actor: comment.author, at: comment.createdAt, kind: "commented" });
  }

  for (const review of node.reviews?.nodes ?? []) {
    // No submittedAt means PENDING
    if (review.submittedAt) {
      events.push({ actor: review.author, at: review.submittedAt, kind: "reviewed" });
    }
  }

  // GitHub does not expose an event for resolving a review thread, nor does it change updatedAt
  // Synthesize an event instead
  for (const thread of node.reviewThreads?.nodes ?? []) {
    const lastComment = thread.comments.nodes[thread.comments.nodes.length - 1];

    if (thread.isResolved && thread.resolvedBy?.login && lastComment) {
      // Synthetic event
      events.push({
        actor: { login: thread.resolvedBy.login, __typename: "User" },
        at: lastComment.createdAt,
        kind: "resolved",
      });
    }
  }

  return events.sort((first, second) => first.at.localeCompare(second.at));
};

export const toItem = (node: RawNode, isPullRequest: boolean, sourceId: number): Item => {
  const events = eventsOf(node);
  const last =
    [...events].reverse().find((event) => !isBot(event.actor)) ?? events[events.length - 1];

  return {
    id: node.id,
    sourceId,
    repo: node.repository.nameWithOwner,
    number: node.number,
    type: isPullRequest ? "pr" : "issue",
    state: (node.prState ?? node.issueState ?? "OPEN") as ItemGitHubState,
    title: node.title,
    url: node.url,
    author: node.author?.login ?? "ghost",
    authorType: node.author?.__typename ?? "User",
    isDraft: !!node.isDraft,
    labels: node.labels.nodes,
    assignees: node.assignees.nodes.map((assignee) => assignee.login),
    participants: node.participants.nodes.map((participant) => participant.login),
    // latestReviews contains the most recent review per reviewer
    reviewers: [
      ...new Set(
        (node.latestReviews?.nodes ?? []).flatMap((review) =>
          review.submittedAt && review.author?.login ? [review.author.login] : [],
        ),
      ),
    ],
    // Team review requests have no login
    reviewRequests: (node.reviewRequests?.nodes ?? []).flatMap((request) =>
      request.requestedReviewer?.login ? [request.requestedReviewer.login] : [],
    ),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt ?? null,
    lastActor: last.actor?.login ?? "ghost",
    lastActorType: last.actor?.__typename ?? "User",
    lastActivityAt: last.at,
    lastActionKind: last.kind,
    fetchedAt: new Date().toISOString(),
  };
};
