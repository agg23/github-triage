import { CheckCircleIcon, KeyIcon } from "@primer/octicons-react";
import { Button, Flash, FormControl, TextInput, Textarea } from "@primer/react";
import { useState } from "react";
import type { Settings, SettingsPatch } from "../../shared/types";
import { api } from "../api";
import { applySettings, useSettings } from "../settings";
import styles from "./SettingsView.module.scss";
import listbox from "./QueueList.module.scss";
import page from "./Page.module.scss";

const splitLogins = (text: string) => text.split(/[\s,]+/).filter(Boolean);

const joinLogins = (logins: string[]) => logins.join("\n");

interface Draft {
  me: string;
  teamMembers: string;
  trustedContributors: string;
  bots: string;
  newWithinHours: string;
}

const draftOf = (settings: Settings): Draft => ({
  me: settings.me,
  teamMembers: joinLogins(settings.teamMembers),
  trustedContributors: joinLogins(settings.trustedContributors),
  bots: joinLogins(settings.bots),
  newWithinHours: String(settings.newWithinHours),
});

interface NameListProps {
  label: string;
  caption: string;
  value: string;
  onChange: (value: string) => void;
}

const NameList: React.FC<NameListProps> = ({ label, caption, value, onChange }) => (
  <FormControl>
    <FormControl.Label>
      {label} ({splitLogins(value).length})
    </FormControl.Label>
    <Textarea
      className={styles.names}
      resize="vertical"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    <FormControl.Caption>{caption}</FormControl.Caption>
  </FormControl>
);

interface SettingsViewProps {
  onChanged: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onChanged }) => {
  const settings = useSettings();
  const [seen, setSeen] = useState(settings);
  const [draft, setDraft] = useState(() => draftOf(settings));
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"token" | "triage" | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  // Settings arrive after the first render and can change fields we did not send
  if (seen !== settings) {
    setSeen(settings);
    setDraft(draftOf(settings));
  }

  const save = async (which: "token" | "triage", patch: SettingsPatch) => {
    setBusy(which);
    setError(undefined);

    try {
      applySettings(await api.updateSettings(patch));
      setToken("");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(undefined);
    }
  };

  const saveTriage = (event: React.FormEvent) => {
    event.preventDefault();

    void save("triage", {
      me: draft.me.trim(),
      teamMembers: splitLogins(draft.teamMembers),
      trustedContributors: splitLogins(draft.trustedContributors),
      bots: splitLogins(draft.bots),
      newWithinHours: Number(draft.newWithinHours),
    });
  };

  const patchDraft = (partial: Partial<Draft>) => setDraft({ ...draft, ...partial });

  return (
    <div className={page.page}>
      {error && (
        <Flash variant="danger" className="shell-flash">
          {error}
        </Flash>
      )}

      <div className={listbox.listbox}>
        <div className={listbox.head}>
          <div className={page.title}>
            <h2>GitHub access</h2>
          </div>
        </div>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void save("token", { githubToken: token.trim() });
          }}
        >
          <div className={styles.who}>
            {settings.hasToken ? (
              <>
                <CheckCircleIcon size={16} />
                <span>Token saved</span>
              </>
            ) : (
              <>
                <KeyIcon size={16} />
                <span>No token saved</span>
              </>
            )}
          </div>

          <FormControl>
            <FormControl.Label>Personal access token</FormControl.Label>
            <TextInput
              className={styles.token}
              type="password"
              autoComplete="off"
              placeholder={settings.hasToken ? "Enter a new token" : "github_pat_..."}
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <FormControl.Caption>
              Requires <code>repo</code> (or <code>public_repo</code>) and <code>read:org</code> permissions
            </FormControl.Caption>
          </FormControl>

          <div className={styles.tokenRow}>
            <Button
              type="submit"
              variant="primary"
              disabled={!token.trim() || busy !== undefined}
              loading={busy === "token"}
            >
              Save token
            </Button>
            {settings.hasToken && (
              <Button
                variant="danger"
                disabled={busy !== undefined}
                onClick={() => void save("token", { githubToken: "" })}
              >
                Remove
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className={listbox.listbox}>
        <div className={listbox.head}>
          <div className={page.title}>
            <h2>Triage</h2>
          </div>
        </div>
        <form className={styles.form} onSubmit={saveTriage}>
          <div className={styles.tokenRow}>
            <FormControl>
              <FormControl.Label>Your username</FormControl.Label>
              <TextInput
                placeholder="octocat"
                value={draft.me}
                onChange={(event) => patchDraft({ me: event.target.value })}
              />
            </FormControl>
            <FormControl>
              <FormControl.Label>Mark items "new" for</FormControl.Label>
              <TextInput
                type="number"
                min={1}
                trailingVisual="hours"
                value={draft.newWithinHours}
                onChange={(event) => patchDraft({ newWithinHours: event.target.value })}
              />
            </FormControl>
          </div>

          <div className={styles.people}>
            <NameList
              label="Team members"
              caption="Their replies do not automatically require your attention"
              value={draft.teamMembers}
              onChange={(teamMembers) => patchDraft({ teamMembers })}
            />
            <NameList
              label="Trusted contributors"
              caption="Notable third parties"
              value={draft.trustedContributors}
              onChange={(trustedContributors) => patchDraft({ trustedContributors })}
            />
            <NameList
              label="Bots"
              caption="GitHub also marks users as bots automatically"
              value={draft.bots}
              onChange={(bots) => patchDraft({ bots })}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={busy !== undefined}
            loading={busy === "triage"}
          >
            Save
          </Button>
        </form>
      </div>
    </div>
  );
};
