import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  SOURCE_KINDS,
  type ActionKind,
  type DetailComment,
  type ItemLabel,
  type ViewRule,
} from "../../shared/types";

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: SOURCE_KINDS }).notNull(),
  owner: text("owner").notNull(),
  repo: text("repo"),
  priority: integer("priority").notNull().default(0),
  backfillDays: integer("backfill_days").notNull().default(30),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at").notNull(),
});

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  // If two sources overlap (an org and one of its repos), last writer wins
  sourceId: integer("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  repo: text("repo").notNull(),
  number: integer("number").notNull(),
  type: text("type", { enum: ["issue", "pr"] }).notNull(),
  state: text("state", { enum: ["OPEN", "CLOSED", "MERGED"] }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  author: text("author").notNull(),
  authorType: text("author_type").notNull(),
  isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
  labels: text("labels", { mode: "json" }).notNull().$type<ItemLabel[]>(),
  assignees: text("assignees", { mode: "json" }).notNull().$type<string[]>(),
  participants: text("participants", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .default(sql`'[]'`),
  reviewers: text("reviewers", { mode: "json" }).notNull().$type<string[]>().default(sql`'[]'`),
  reviewRequests: text("review_requests", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .default(sql`'[]'`),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  closedAt: text("closed_at"),
  lastActor: text("last_actor").notNull(),
  lastActorType: text("last_actor_type").notNull(),
  lastActivityAt: text("last_activity_at").notNull(),
  lastActionKind: text("last_action_kind").$type<ActionKind>(),
  fetchedAt: text("fetched_at").notNull(),
});

export const itemDetails = sqliteTable("item_details", {
  itemId: text("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  bodyHTML: text("body_html").notNull(),
  comments: text("comments", { mode: "json" }).notNull().$type<DetailComment[]>(),
  commentCount: integer("comment_count").notNull().default(0),
  additions: integer("additions"),
  deletions: integer("deletions"),
  changedFiles: integer("changed_files"),
  fetchedAt: text("fetched_at").notNull(),
});

export const views = sqliteTable("views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  rules: text("rules", { mode: "json" }).notNull().$type<ViewRule[]>(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const itemState = sqliteTable("item_state", {
  itemId: text("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  wakeAt: text("wake_at"),
  wakeOnActivityAfter: text("wake_on_activity_after"),
  createdAt: text("created_at").notNull(),
});
