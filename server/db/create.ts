import type Database from "better-sqlite3";
import { SQL, is } from "drizzle-orm";
import { SQLiteSyncDialect, getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

const dialect = new SQLiteSyncDialect();

const quote = (name: string) => `\`${name}\``;

const defaultValue = (value: unknown): string => {
  if (is(value, SQL)) {
    return dialect.sqlToQuery(value).sql;
  }

  if (typeof value === "string") {
    return `'${value.replaceAll("'", "''")}'`;
  }

  return String(value);
};

const autoIncrements = (column: unknown) =>
  (column as { autoIncrement?: boolean }).autoIncrement === true;

const columnDdl = (column: ReturnType<typeof getTableConfig>["columns"][number]): string => {
  const parts = [quote(column.name), column.getSQLType()];

  if (column.primary) {
    parts.push(autoIncrements(column) ? "PRIMARY KEY AUTOINCREMENT" : "PRIMARY KEY");
  }

  if (column.notNull) {
    parts.push("NOT NULL");
  }

  if (column.hasDefault && column.default !== undefined) {
    parts.push(`DEFAULT ${defaultValue(column.default)}`);
  }

  return parts.join(" ");
};

const tableDdl = (table: SQLiteTable): string => {
  const { name, columns, foreignKeys } = getTableConfig(table);
  const lines = columns.map(columnDdl);

  for (const foreignKey of foreignKeys) {
    const { columns: from, foreignTable, foreignColumns } = foreignKey.reference();
    const to = getTableConfig(foreignTable).name;

    lines.push(
      `FOREIGN KEY (${from.map((column) => quote(column.name)).join(", ")}) ` +
        `REFERENCES ${quote(to)}(${foreignColumns.map((column) => quote(column.name)).join(", ")})` +
        (foreignKey.onDelete ? ` ON DELETE ${foreignKey.onDelete}` : "") +
        (foreignKey.onUpdate ? ` ON UPDATE ${foreignKey.onUpdate}` : ""),
    );
  }

  return `CREATE TABLE IF NOT EXISTS ${quote(name)} (\n  ${lines.join(",\n  ")}\n)`;
};

/**
 * Creates whatever tables the database is missing from the definitions in schema.ts
 */
export const createTables = (sqlite: Database.Database, tables: SQLiteTable[]) => {
  for (const table of tables) {
    sqlite.exec(tableDdl(table));
  }
};
