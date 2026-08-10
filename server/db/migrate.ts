import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type * as schema from "./schema";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "migrations");

const BASELINE_TABLE = "items";

const MIGRATIONS_TABLE = "__drizzle_migrations";

const tableNames = (sqlite: Database.Database): Set<string> => {
  const rows = sqlite
    .prepare("select name from sqlite_master where type = 'table'")
    .all() as { name: string }[];

  return new Set(rows.map((row) => row.name));
};

/**
 * If we don't have `__drizzle_migrations` table, assume we're at version 0000 and stamp it
 */
const adoptExisting = (sqlite: Database.Database) => {
  // Nothing to adopt in a new file. Let the migrations build it from nothing
  if (!tableNames(sqlite).has(BASELINE_TABLE)) {
    return;
  }

  const [baseline] = readMigrationFiles({ migrationsFolder });

  sqlite.exec(
    `create table if not exists \`${MIGRATIONS_TABLE}\` ` +
      `(id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );

  const { tracked } = sqlite
    .prepare(`select count(*) tracked from \`${MIGRATIONS_TABLE}\` where created_at >= ?`)
    .get(baseline.folderMillis) as { tracked: number };

  if (tracked > 0) {
    return;
  }

  sqlite.exec(`delete from \`${MIGRATIONS_TABLE}\``);
  sqlite
    .prepare(`insert into \`${MIGRATIONS_TABLE}\` (hash, created_at) values (?, ?)`)
    .run(baseline.hash, baseline.folderMillis);

  console.log("[db] adopted an existing database at migration 0000");
};

/**
 * Brings the database up to the current schema
 */
export const migrateToLatest = (
  sqlite: Database.Database,
  db: BetterSQLite3Database<typeof schema>,
) => {
  adoptExisting(sqlite);
  migrate(db, { migrationsFolder });
};
