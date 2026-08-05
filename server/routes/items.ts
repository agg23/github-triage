import { and, desc, eq, like, SQL, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { items } from "../db/schema";

const DEFAULT_QUERY_LIMIT = 200;
const MAX_QUERY_LIMIT = 1000;

export const itemRoutes = new Hono();

itemRoutes.get("/items", (context) => {
  const query = context.req.query();
  const conditions: SQL[] = [];

  if (query.repo) {
    conditions.push(eq(items.repo, query.repo));
  }

  if (query.author) {
    conditions.push(eq(items.author, query.author));
  }

  if (query.type === "issue" || query.type === "pr") {
    conditions.push(eq(items.type, query.type));
  }

  if (query.state) {
    conditions.push(eq(items.state, query.state.toUpperCase() as "OPEN"));
  }

  if (query.updatedAfter) {
    conditions.push(sql`${items.updatedAt} >= ${query.updatedAfter}`);
  }

  if (query.search) {
    conditions.push(like(items.title, `%${query.search}%`));
  }

  const limit = Math.min(Number(query.limit ?? DEFAULT_QUERY_LIMIT), MAX_QUERY_LIMIT);
  const rows = db
    .select()
    .from(items)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(items.lastActivityAt))
    .limit(limit)
    .all();

  return context.json(rows);
});

itemRoutes.get("/stats-items", (context) => {
  const rows = db
    .select({
      type: items.type,
      createdAt: items.createdAt,
      closedAt: items.closedAt,
      author: items.author,
      authorType: items.authorType,
      labels: items.labels,
    })
    .from(items)
    .all();

  return context.json(rows.map((row) => ({ ...row, labels: row.labels.map((label) => label.name) })));
});
