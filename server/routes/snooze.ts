import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { itemState, items } from "../db/schema";

interface SnoozeBody {
  wakeAt?: string | null;
  wakeOnActivity?: boolean;
}

export const snoozeRoutes = new Hono();

snoozeRoutes.get("/item-states", (context) => {
  // Drop woken rows lazily, so clients never see an "expired" snooze
  const now = new Date().toISOString();
  db.run(sql`
    delete from item_state where item_id in (
      select s.item_id from item_state s join items i on i.id = s.item_id
      where (s.wake_at is not null and s.wake_at <= ${now})
         or (s.wake_on_activity_after is not null and i.last_activity_at > s.wake_on_activity_after)
    )
  `);

  return context.json(db.select().from(itemState).all());
});

snoozeRoutes.put("/items/:id/state", async (context) => {
  const id = context.req.param("id");
  const body = await context.req.json<SnoozeBody>();
  const wakeAt = body.wakeAt ?? null;

  if (wakeAt !== null && Number.isNaN(Date.parse(wakeAt))) {
    return context.json({ error: "wakeAt must be an ISO timestamp" }, 400);
  }

  if (!wakeAt && !body.wakeOnActivity) {
    return context.json(
      { error: "at least one wake condition (wakeAt, wakeOnActivity) is required" },
      400,
    );
  }

  const item = db.select().from(items).where(eq(items.id, id)).get();

  if (!item) {
    return context.json({ error: "item not found" }, 404);
  }

  const wakeOnActivityAfter = body.wakeOnActivity ? item.lastActivityAt : null;
  const row = db
    .insert(itemState)
    .values({ itemId: id, wakeAt, wakeOnActivityAfter, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: itemState.itemId, set: { wakeAt, wakeOnActivityAfter } })
    .returning()
    .get();

  return context.json(row);
});

snoozeRoutes.delete("/items/:id/state", (c) => {
  const deleted = db
    .delete(itemState)
    .where(eq(itemState.itemId, c.req.param("id")))
    .returning()
    .get();

  return deleted ? c.json(deleted) : c.json({ error: "not found" }, 404);
});
