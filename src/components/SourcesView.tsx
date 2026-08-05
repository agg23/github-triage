import { RepoIcon, TrashIcon } from "@primer/octicons-react";
import {
  Button,
  CounterLabel,
  Flash,
  FormControl,
  IconButton,
  Label,
  RelativeTime,
  Select,
  TextInput,
  useConfirm,
} from "@primer/react";
import { useState } from "react";
import { SOURCE_KINDS, type SourceKind } from "../../shared/types";
import { api, type SourceWithCount } from "../api";
import row from "./ItemRow.module.scss";
import styles from "./Page.module.scss";
import listbox from "./QueueList.module.scss";

const scopeOf = (source: SourceWithCount) =>
  source.repo ? `${source.owner}/${source.repo}` : `${source.kind}:${source.owner}`;

interface SourcesViewProps {
  sources: SourceWithCount[];
  onChanged: () => void;
}

export const SourcesView: React.FC<SourcesViewProps> = ({ sources, onChanged }) => {
  const [kind, setKind] = useState<SourceKind>("repo");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [priority, setPriority] = useState(0);
  const [backfillDays, setBackfillDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const confirm = useConfirm();

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);

    try {
      await api.addSource({
        kind,
        owner: owner.trim(),
        repo: kind === "repo" ? repo.trim() : undefined,
        priority,
        backfillDays,
      });
      setOwner("");
      setRepo("");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (source: SourceWithCount) => {
    const confirmed = await confirm({
      title: "Remove source?",
      content: `Remove ${scopeOf(source)} and its ${source.itemCount} cached items?`,
      confirmButtonContent: "Remove",
      confirmButtonType: "danger",
    });

    if (!confirmed) {
      return;
    }

    setError(undefined);

    try {
      await api.deleteSource(source.id);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <div className={styles.page}>
      {error && (
        <Flash variant="danger" className="shell-flash">
          {error}
        </Flash>
      )}

      <div className={listbox.listbox}>
        <div className={listbox.head}>
          <div className={styles.title}>
            <h2>Watched sources</h2>
            <CounterLabel>{sources.length}</CounterLabel>
            <span className={styles.blurb}>
              user/org sources watch every repo owned by that account
            </span>
          </div>
        </div>
        <div>
          {sources.length === 0 && (
            <p className={styles.empty}>No sources yet, add one below.</p>
          )}
          {sources.map((source) => (
            <div key={source.id} className={row.item}>
              <div className={`${row.state} ${row.stateDraft}`}>
                <RepoIcon />
              </div>
              <div className={row.main}>
                <div className={row.titleLine}>
                  <span className={row.title}>
                    {source.repo ? `${source.owner}/${source.repo}` : source.owner}
                  </span>
                  <Label size="small" variant="secondary">
                    {source.kind}
                  </Label>
                  {source.priority !== 0 && (
                    <Label size="small" variant="accent">
                      priority {source.priority}
                    </Label>
                  )}
                </div>
                <div className={row.meta}>
                  <span>{source.itemCount} items cached</span>
                  <span className={row.metaSep}>·</span>
                  <span>
                    {source.lastSyncedAt ? (
                      <>
                        synced <RelativeTime datetime={source.lastSyncedAt} />
                      </>
                    ) : (
                      "never synced"
                    )}
                  </span>
                </div>
              </div>
              <div className={`${row.actions} ${row.actionsVisible}`}>
                <IconButton
                  icon={TrashIcon}
                  size="small"
                  variant="invisible"
                  aria-label={`Remove ${scopeOf(source)}`}
                  onClick={() => void remove(source)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={listbox.listbox}>
        <div className={listbox.head}>
          <div className={styles.title}>
            <h2>Add source</h2>
          </div>
        </div>
        <form className={styles.formRow} onSubmit={(event) => void add(event)}>
          <FormControl>
            <FormControl.Label>Kind</FormControl.Label>
            <Select value={kind} onChange={(event) => setKind(event.target.value as SourceKind)}>
              {SOURCE_KINDS.map((sourceKind) => (
                <Select.Option key={sourceKind} value={sourceKind}>
                  {sourceKind}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
          <FormControl required>
            <FormControl.Label>{kind === "repo" ? "Owner" : "Account"}</FormControl.Label>
            <TextInput
              placeholder={kind === "repo" ? "microsoft" : "user"}
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            />
          </FormControl>
          {kind === "repo" && (
            <FormControl required>
              <FormControl.Label>Repo</FormControl.Label>
              <TextInput
                placeholder="homeassistant"
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
              />
            </FormControl>
          )}
          <FormControl>
            <FormControl.Label>Priority</FormControl.Label>
            <TextInput
              type="number"
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
            />
          </FormControl>
          <FormControl>
            <FormControl.Label>Backfill days</FormControl.Label>
            <TextInput
              type="number"
              min={1}
              value={backfillDays}
              onChange={(event) => setBackfillDays(Number(event.target.value))}
            />
          </FormControl>
          <Button type="submit" variant="primary" disabled={busy || !owner.trim()} loading={busy}>
            Add
          </Button>
        </form>
      </div>
    </div>
  );
};
