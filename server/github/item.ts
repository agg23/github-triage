import type {
  ActionKind,
  DetailComment,
  Item,
  ItemDetail,
  ItemGitHubState,
} from "../../shared/types";
import {
  DETAIL_COMMENTS,
  type Actor,
  type RawDetailNode,
  type RawNode,
  type RawReview,
} from "./schema";

interface ItemEvent {
  actor: Actor | null;
  at: string;
  kind: ActionKind;
  /** Anchor URL of the comment/review behind this event, if any. Pushes have none */
  url?: string;
}

const isBot = (actor: Actor | null) =>
  actor?.__typename === "Bot" || (actor?.login ?? "").endsWith("[bot]");

const eventsOf = (node: RawNode): ItemEvent[] => {
  const events: ItemEvent[] = [{ actor: node.author, at: node.createdAt, kind: "opened" }];

  for (const comment of node.comments.nodes) {
    events.push({ actor: comment.author, at: comment.createdAt, kind: "commented", url: comment.url });
  }

  for (const review of node.reviews?.nodes ?? []) {
    // No submittedAt means PENDING
    if (review.submittedAt) {
      events.push({
        actor: review.author,
        at: review.submittedAt,
        kind: "reviewed",
        // If there is no body, use the latest comment as the link
        url: review.bodyHTML ? review.url : (review.comments?.nodes[0]?.url ?? review.url),
      });
    }
  }

  // The timeline has no event for an ordinary push, so use the tip commit's date
  for (const { commit } of node.commits?.nodes ?? []) {
    events.push({
      actor: commit.author?.user ?? null,
      at: commit.committedDate,
      kind: "pushed",
    });
  }

  // A force push can carry an older committedDate, so take the push time from GitHub's timeline
  for (const forcePush of node.timelineItems?.nodes ?? []) {
    events.push({
      actor: forcePush.actor,
      at: forcePush.createdAt,
      kind: "pushed",
    });
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
        url: lastComment.url,
      });
    }
  }

  return events.sort((first, second) => first.at.localeCompare(second.at));
};

const reviewBody = (review: RawReview): string =>
  review.bodyHTML || review.comments?.nodes[0]?.bodyHTML || "";

const reviewsAsComments = (node: RawDetailNode): DetailComment[] =>
  (node.reviews?.nodes ?? []).flatMap((review) =>
    review.submittedAt
      ? [
          {
            author: review.author?.login ?? "ghost",
            authorType: review.author?.__typename ?? "User",
            createdAt: review.submittedAt,
            bodyHTML: reviewBody(review),
            reviewState: review.state,
            fileComments: review.comments?.totalCount ?? 0,
          },
        ]
      : [],
  );

export const toDetail = (node: RawDetailNode): ItemDetail => ({
  itemId: node.id,
  bodyHTML: node.bodyHTML ?? "",
  comments: [
    ...node.comments.nodes.map((comment) => ({
      author: comment.author?.login ?? "ghost",
      authorType: comment.author?.__typename ?? "User",
      createdAt: comment.createdAt,
      bodyHTML: comment.bodyHTML ?? "",
    })),
    ...reviewsAsComments(node),
  ]
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
    .slice(-DETAIL_COMMENTS),
  commentCount:
    (node.comments.totalCount ?? node.comments.nodes.length) + (node.reviews?.totalCount ?? 0),
  additions: node.additions ?? null,
  deletions: node.deletions ?? null,
  changedFiles: node.changedFiles ?? null,
  fetchedAt: new Date().toISOString(),
});

export const toItem = (node: RawNode, isPullRequest: boolean, sourceId: number): Item => {
  const events = eventsOf(node);

  // Last non-bot entry
  const last =
    [...events].reverse().find((event) => !isBot(event.actor)) ?? events[events.length - 1];
  // Newest entry we can link to on the item's page; pushes are not anchorable
  const newestLinkable = [...events].reverse().find((event) => event.url);

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
    lastCommentUrl: newestLinkable?.url ?? null,
    fetchedAt: new Date().toISOString(),
  };
};
