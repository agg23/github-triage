export const CONNECTIONS = ["issues", "pullRequests"] as const;
export type Connection = (typeof CONNECTIONS)[number];

const ITEM_FIELDS = `
  id number title url createdAt updatedAt closedAt
  author { login __typename }
  repository { nameWithOwner }
  labels(first: 20) { nodes { name color } }
  assignees(first: 10) { nodes { login } }
  comments(last: 5) { nodes { author { login __typename } createdAt } }
  participants(first: 100) { nodes { login } }
`;

export const ISSUE_FIELDS = `${ITEM_FIELDS} issueState: state`;

export const PR_FIELDS = `
  ${ITEM_FIELDS}
  prState: state
  isDraft
  reviews(last: 5) { nodes { author { login __typename } submittedAt } }
  latestReviews(first: 10) { nodes { author { login __typename } submittedAt } }
  reviewThreads(last: 15) {
    nodes {
      isResolved
      resolvedBy { login }
      comments(last: 1) { nodes { author { login __typename } createdAt } }
    }
  }
  reviewRequests(first: 10) {
    nodes { requestedReviewer { ... on User { login } } }
  }
`;

export const fieldsFor = (connection: Connection): string =>
  connection === "pullRequests" ? PR_FIELDS : ISSUE_FIELDS;

export interface Connected<T> {
  nodes: T[];
}

export interface Actor {
  login?: string;
  __typename?: string;
}

export interface RawLabel {
  name: string;
  color: string;
}

export interface RawComment {
  author: Actor | null;
  createdAt: string;
}

export interface RawReview {
  author: Actor | null;
  submittedAt: string;
}

export interface RawReviewThread {
  isResolved: boolean;
  resolvedBy: { login: string } | null;
  comments: Connected<RawComment>;
}

export interface RawReviewRequest {
  requestedReviewer: { login?: string } | null;
}

export interface RawNode {
  __typename?: "Issue" | "PullRequest";
  id: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  issueState?: string;
  prState?: string;
  isDraft?: boolean;
  author: Actor | null;
  repository: { nameWithOwner: string };
  labels: Connected<RawLabel>;
  assignees: Connected<{ login: string }>;
  comments: Connected<RawComment>;
  participants: Connected<{ login: string }>;
  reviews?: Connected<RawReview>;
  latestReviews?: Connected<RawReview>;
  reviewThreads?: Connected<RawReviewThread>;
  reviewRequests?: Connected<RawReviewRequest>;
}

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface NodePage {
  pageInfo: PageInfo;
  nodes: RawNode[];
}

export interface RateLimit {
  remaining: number;
}

// Only the connection the query asked for is actually present
export interface RepositoryResponse {
  rateLimit?: RateLimit;
  repository: Record<Connection, NodePage> | null;
}

export interface NodesResponse {
  rateLimit?: RateLimit;
  nodes: (RawNode | null)[] | null;
}
