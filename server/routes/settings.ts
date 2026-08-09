import { Hono } from "hono";
import type { SettingsPatch } from "../../shared/types";
import { GitHubError, fetchViewerLogin } from "../github/client";
import { publicSettings, readSettings, writeSettings, type SettingsRow } from "../settings";

const MAX_NEW_WITHIN_HOURS = 24 * 365;

export const settingsRoutes = new Hono();

settingsRoutes.get("/settings", (context) => context.json(publicSettings()));

settingsRoutes.put("/settings", async (context) => {
  const body = await context.req.json<SettingsPatch>();
  const patch: Partial<SettingsRow> = {};

  for (const key of ["teamMembers", "trustedContributors", "bots"] as const) {
    if (body[key] !== undefined) {
      const logins = parseLogins(body[key]);

      if (!logins) {
        return context.json({ error: `${key} must be an array of logins` }, 400);
      }

      patch[key] = logins;
    }
  }

  if (body.me !== undefined) {
    if (typeof body.me !== "string") {
      return context.json({ error: "me must be a login" }, 400);
    }

    patch.me = body.me.trim().replace(/^@/, "");
  }

  if (body.newWithinHours !== undefined) {
    const hours = Number(body.newWithinHours);

    if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_NEW_WITHIN_HOURS) {
      return context.json({ error: `newWithinHours must be between 1 and ${MAX_NEW_WITHIN_HOURS}` }, 400);
    }

    patch.newWithinHours = Math.round(hours);
  }

  if (body.githubToken !== undefined) {
    const token = body.githubToken.trim();

    if (!token) {
      patch.githubToken = null;
      patch.tokenLogin = null;
    } else {
      try {
        // Check if the token is valid
        const login = await fetchViewerLogin(token);

        patch.githubToken = token;
        patch.tokenLogin = login;

        // Update our username if we have none
        if (patch.me === undefined && !readSettings().me) {
          patch.me = login;
        }
      } catch (caught) {
        const message = caught instanceof GitHubError ? caught.message : String(caught);

        return context.json({ error: message }, 400);
      }
    }
  }

  return context.json(publicSettings(writeSettings(patch)));
});

const parseLogins = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || value.some((login) => typeof login !== "string")) {
    return undefined;
  }

  const cleaned = (value as string[]).map((login) => login.trim().replace(/^@/, ""));

  return [...new Set(cleaned.filter(Boolean))];
};
