import "./env";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { GITHUB_TOKEN, PORT, SYNC_INTERVAL_MS } from "./env";
import { itemRoutes } from "./routes/items";
import { snoozeRoutes } from "./routes/snooze";
import { sourceRoutes } from "./routes/sources";
import { syncRoutes } from "./routes/sync";
import { viewRoutes } from "./routes/views";
import { syncAll } from "./sync";

const app = new Hono();
const api = new Hono();

api.route("/", sourceRoutes);
api.route("/", viewRoutes);
api.route("/", snoozeRoutes);
api.route("/", itemRoutes);
api.route("/", syncRoutes);

app.route("/api", api);

// Production only. In dev, Vite proxies /api here and serves the app itself
app.use("/*", serveStatic({ root: "./dist" }));
app.use("/*", serveStatic({ root: "./dist", path: "index.html" }));

const pollLoop = async () => {
  if (!GITHUB_TOKEN) {
    console.warn("[poll] GITHUB_TOKEN not set, skipping scheduled sync");

    return;
  }

  const { ran, stats, errors } = await syncAll();

  if (ran) {
    const total = stats.reduce((sum, stat) => sum + stat.upserted, 0);
    console.log(`[poll] synced ${stats.length} sources, ${total} items updated`);

    for (const error of errors) {
      console.error(`[poll] error: ${error}`);
    }
  }
};

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`server on http://localhost:${info.port}`);
  void pollLoop();
  setInterval(() => void pollLoop(), SYNC_INTERVAL_MS);
});
