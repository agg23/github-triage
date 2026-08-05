import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { parseQuery } from "../../shared/query";
import { RULE_ACTIONS, type ViewRule } from "../../shared/types";
import { db } from "../db";
import { views } from "../db/schema";

interface ViewBody {
  name?: string;
  rules?: unknown;
  isDefault?: boolean;
}

interface CheckedRules {
  rules: ViewRule[];
  warnings: string[];
}

const validateRules = (rules: unknown): CheckedRules | undefined => {
  if (!Array.isArray(rules)) {
    return undefined;
  }

  const warnings: string[] = [];
  for (const [index, rule] of rules.entries()) {
    if (typeof rule?.query !== "string" || !RULE_ACTIONS.includes(rule?.action)) {
      return undefined;
    }

    for (const warning of parseQuery(rule.query).warnings) {
      warnings.push(`rule ${index + 1}: ${warning}`);
    }
  }

  return { rules: rules as ViewRule[], warnings };
};

export const viewRoutes = new Hono();

viewRoutes.get("/views", (context) => context.json(db.select().from(views).all()));

viewRoutes.post("/views", async (context) => {
  const body = await context.req.json<ViewBody>();
  const checked = validateRules(body.rules ?? []);

  if (!body.name || !checked) {
    return context.json(
      { error: "name and rules [{query, action: filter|show|mute|hide}] are required" },
      400,
    );
  }

  if (body.isDefault) {
    db.update(views).set({ isDefault: false }).run();
  }

  const row = db
    .insert(views)
    .values({
      name: body.name,
      rules: checked.rules,
      isDefault: body.isDefault ?? false,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  return context.json({ ...row, warnings: checked.warnings }, 201);
});

viewRoutes.put("/views/:id", async (context) => {
  const id = Number(context.req.param("id"));
  const body = await context.req.json<ViewBody>();
  const checked =
    body.rules !== undefined ? validateRules(body.rules) : { rules: undefined, warnings: [] };

  if (!checked) {
    return context.json({ error: "rules must be [{query, action: filter|show|mute|hide}]" }, 400);
  }

  if (body.isDefault) {
    db.update(views).set({ isDefault: false }).run();
  }

  const row = db
    .update(views)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(checked.rules !== undefined && { rules: checked.rules }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
    })
    .where(eq(views.id, id))
    .returning()
    .get();

  return row ? context.json({ ...row, warnings: checked.warnings }) : context.json({ error: "not found" }, 404);
});

viewRoutes.delete("/views/:id", (context) => {
  const id = Number(context.req.param("id"));
  const deleted = db.delete(views).where(eq(views.id, id)).returning().get();

  return deleted ? context.json(deleted) : context.json({ error: "not found" }, 404);
});
