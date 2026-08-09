import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTables } from "./create";
import * as schema from "./schema";
import { itemDetails, itemState, items, settings, sources, views } from "./schema";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const databasePath = process.env.DATABASE_PATH ?? join(root, "data", "triage.db");

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

createTables(sqlite, [sources, items, itemDetails, views, itemState, settings]);

export const db = drizzle(sqlite, { schema });
