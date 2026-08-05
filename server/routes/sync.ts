import { Hono } from "hono";
import { syncAll } from "../sync";

export const syncRoutes = new Hono();

syncRoutes.post("/sync", async (context) => {
  const result = await syncAll(true);

  return context.json(result, result.ran ? 200 : 409);
});
