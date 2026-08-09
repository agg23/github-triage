import { eq } from "drizzle-orm";
import type { Settings } from "../shared/types";
import { db } from "./db";
import { settings } from "./db/schema";

// Settings are a single row
const ROW_ID = 1;

export type SettingsRow = typeof settings.$inferSelect;

export const readSettings = (): SettingsRow =>
  db.select().from(settings).where(eq(settings.id, ROW_ID)).get() ??
  db
    .insert(settings)
    .values({ id: ROW_ID, updatedAt: new Date().toISOString() })
    .returning()
    .get();

export const writeSettings = (patch: Partial<SettingsRow>): SettingsRow => {
  readSettings();

  return db
    .update(settings)
    .set({ ...patch, id: undefined, updatedAt: new Date().toISOString() })
    .where(eq(settings.id, ROW_ID))
    .returning()
    .get();
};

export const githubToken = (): string => readSettings().githubToken ?? "";

export const publicSettings = (row: SettingsRow = readSettings()): Settings => ({
  me: row.me,
  teamMembers: row.teamMembers,
  trustedContributors: row.trustedContributors,
  bots: row.bots,
  newWithinHours: row.newWithinHours,
  hasToken: !!row.githubToken,
  tokenLogin: row.tokenLogin,
});
