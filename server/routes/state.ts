import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { itemState, items } from "../db/schema";

interface SnoozeBody {
  wakeAt?: string | null;
  wakeOnActivity?: boolean;
}

export const stateRoutes = new Hono();

/** Rows that have left their sleep period */
const woken = (now: string) => sql`
  item_id in (
    select s.item_id from item_state s join items i on i.id = s.item_id
    where (s.wake_at is not null and s.wake_at <= ${now})
       or (s.wake_on_activity_after is not null and i.activity_at > s.wake_on_activity_after)
  )
`;

/** Remove rows without interesting info */
const pruneEmpty = (itemId: string) =>
  db
    .delete(itemState)
    .where(
      and(
        eq(itemState.itemId, itemId),
        isNull(itemState.wakeAt),
        isNull(itemState.wakeOnActivityAfter),
        isNull(itemState.flaggedAt),
      ),
    )
    .returning()
    .get();

const itemExists = (id: string) => db.select().from(items).where(eq(items.id, id)).get() !== undefined;

stateRoutes.get("/item-states", (context) => {
  const now = new Date().toISOString();

  // Kill any snoozes that happen to be available at this time
  db.run(sql`
    update item_state set wake_at = null, wake_on_activity_after = null
    where flagged_at is not null and ${woken(now)}
  `);
  db.run(sql`delete from item_state where flagged_at is null and ${woken(now)}`);

  return context.json(db.select().from(itemState).all());
});

stateRoutes.put("/items/:id/state", async (context) => {
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

  const wakeOnActivityAfter = body.wakeOnActivity ? item.activityAt : null;
  const row = db
    .insert(itemState)
    .values({ itemId: id, wakeAt, wakeOnActivityAfter, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: itemState.itemId, set: { wakeAt, wakeOnActivityAfter } })
    .returning()
    .get();

  return context.json(row);
});

stateRoutes.delete("/items/:id/state", (context) => {
  const id = context.req.param("id");
  const row = db
    .update(itemState)
    .set({ wakeAt: null, wakeOnActivityAfter: null })
    .where(eq(itemState.itemId, id))
    .returning()
    .get();

  if (!row) {
    return context.json({ error: "not found" }, 404);
  }

  return context.json(pruneEmpty(id) ?? row);
});

stateRoutes.put("/items/:id/flag", (context) => {
  const id = context.req.param("id");

  if (!itemExists(id)) {
    return context.json({ error: "item not found" }, 404);
  }

  const flaggedAt = new Date().toISOString();
  // Flagging says we need to see this, so don't hide
  const row = db
    .insert(itemState)
    .values({ itemId: id, flaggedAt, createdAt: flaggedAt })
    .onConflictDoUpdate({
      target: itemState.itemId,
      set: { flaggedAt, wakeAt: null, wakeOnActivityAfter: null },
    })
    .returning()
    .get();

  return context.json(row);
});

stateRoutes.delete("/items/:id/flag", (context) => {
  const id = context.req.param("id");
  const row = db
    .update(itemState)
    .set({ flaggedAt: null })
    .where(eq(itemState.itemId, id))
    .returning()
    .get();

  if (!row) {
    return context.json({ error: "not found" }, 404);
  }

  return context.json(pruneEmpty(id) ?? row);
});
