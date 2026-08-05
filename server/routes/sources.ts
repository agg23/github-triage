import { count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { SOURCE_KINDS, type SourceKind } from "../../shared/types";
import { db } from "../db";
import { items, sources } from "../db/schema";

interface NewSourceBody {
  kind: SourceKind;
  owner: string;
  repo?: string;
  priority?: number;
  backfillDays?: number;
}

export const sourceRoutes = new Hono();

sourceRoutes.get("/sources", (context) => {
  const rows = db.select().from(sources).all();
  const counts = db
    .select({ sourceId: items.sourceId, total: count() })
    .from(items)
    .groupBy(items.sourceId)
    .all();
  const totalBySource = new Map(counts.map((row) => [row.sourceId, row.total]));

  return context.json(rows.map((row) => ({ ...row, itemCount: totalBySource.get(row.id) ?? 0 })));
});

sourceRoutes.post("/sources", async (context) => {
  const body = await context.req.json<NewSourceBody>();

  if (!SOURCE_KINDS.includes(body.kind) || !body.owner) {
    return context.json({ error: "kind (user|org|repo) and owner are required" }, 400);
  }

  if (body.kind === "repo" && !body.repo) {
    return context.json({ error: 'kind "repo" requires a repo name' }, 400);
  }

  const row = db
    .insert(sources)
    .values({
      kind: body.kind,
      owner: body.owner,
      repo: body.kind === "repo" ? body.repo : null,
      priority: body.priority ?? 0,
      backfillDays: body.backfillDays ?? 30,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  return context.json(row, 201);
});

sourceRoutes.delete("/sources/:id", (context) => {
  const id = Number(context.req.param("id"));
  const deleted = db.delete(sources).where(eq(sources.id, id)).returning().get();

  return deleted ? context.json(deleted) : context.json({ error: "not found" }, 404);
});
