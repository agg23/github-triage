export const SOURCE_KINDS = ["user", "org", "repo"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface Source {
  id: number;
  kind: SourceKind;
  owner: string;
  // TODO: Only set for kind "repo"
  repo: string | null;
  // Higher sorts first in the needs-attention ordering
  priority: number;
  backfillDays: number;
  lastSyncedAt: string | null;
  createdAt: string;
}

export type ItemType = "issue" | "pr";
export type ItemGitHubState = "OPEN" | "CLOSED" | "MERGED";
export type ActionKind = "opened" | "commented" | "reviewed" | "resolved";

export interface ItemLabel {
  name: string;
  color: string;
}

export interface Item {
  id: string;
  sourceId: number;
  /** Of the form "owner/name" */
  repo: string;
  number: number;
  type: ItemType;
  state: ItemGitHubState;
  title: string;
  url: string;
  author: string;
  /** GraphQL __typename */
  authorType: string;
  isDraft: boolean;
  labels: ItemLabel[];
  assignees: string[];
  participants: string[];
  reviewers: string[];
  reviewRequests: string[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lastActor: string;
  lastActorType: string;
  lastActivityAt: string;
  lastActionKind: ActionKind | null;
  fetchedAt: string;
}

export interface DetailComment {
  author: string;
  authorType: string;
  createdAt: string;
  bodyHTML: string;
  reviewState?: string;
  fileComments?: number;
}

export interface ItemDetail {
  itemId: string;
  bodyHTML: string;
  comments: DetailComment[];
  commentCount: number;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
  fetchedAt: string;
}

export interface TriageSettings {
  /** User's account name */
  me: string;
  /** Core team account names */
  teamMembers: string[];
  /** Trusted external contributor account names */
  trustedContributors: string[];
  /** Known bot account names */
  bots: string[];
  /** Items created within this many hours land in the New bucket */
  newWithinHours: number;
}

/** Settings exposed to the browser */
export interface Settings extends TriageSettings {
  hasToken: boolean;
  /** The account the token belonged to when it was saved */
  tokenLogin: string | null;
}

export interface SettingsPatch extends Partial<TriageSettings> {
  /** An empty string clears the stored token */
  githubToken?: string;
}

export const RULE_ACTIONS = ["filter", "show", "mute", "hide"] as const;
export type RuleAction = (typeof RULE_ACTIONS)[number];

export type DisplayAction = Exclude<RuleAction, "filter">;

export interface ViewRule {
  query: string;
  action: RuleAction;
}

export interface View {
  id: number;
  name: string;
  rules: ViewRule[];
  isDefault: boolean;
  createdAt: string;
}

export interface ItemState {
  itemId: string;
  wakeAt: string | null;
  wakeOnActivityAfter?: string;
  createdAt: string;
}

export interface SyncStats {
  sourceId: number;
  scope: string;
  upserted: number;
  pages: number;
  rateLimitRemaining?: number;
}

export interface SyncResult {
  ran: boolean;
  stats: SyncStats[];
  errors: string[];
}
