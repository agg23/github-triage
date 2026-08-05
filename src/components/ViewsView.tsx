import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  StarFillIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from "@primer/octicons-react";
import {
  Button,
  CounterLabel,
  Flash,
  FormControl,
  IconButton,
  Label,
  Select,
  TextInput,
  useConfirm,
} from "@primer/react";
import { useState } from "react";
import { parseQuery } from "../../shared/query";
import { RULE_ACTIONS, type RuleAction, type View, type ViewRule } from "../../shared/types";
import { api } from "../api";
import row from "./ItemRow.module.scss";
import styles from "./Page.module.scss";
import listbox from "./QueueList.module.scss";

const ACTION_EXPLANATION: Record<RuleAction, string> = {
  filter: "narrows the set, so only matching items are in play at all",
  show: "full strength (use it to promote items past an earlier mute/hide)",
  mute: "dimmed in place, deprioritized but still scannable",
  hide: "not rendered",
};

const QUERY_PLACEHOLDER = "GitHub search query, such as repo:microsoft/playwright crash";

// `editing` sentinel: creating rather than editing an existing id
const NEW_VIEW = -1;

interface RuleEditorProps {
  rules: ViewRule[];
  setRules: (rules: ViewRule[]) => void;
}

const RuleEditor: React.FC<RuleEditorProps> = ({ rules, setRules }) => {
  const patch = (index: number, partial: Partial<ViewRule>) =>
    setRules(rules.map((rule, at) => (at === index ? { ...rule, ...partial } : rule)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= rules.length) {
      return;
    }

    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    setRules(next);
  };

  return (
    <div className={styles.ruleList}>
      {rules.map((rule, index) => {
        const warnings = parseQuery(rule.query).warnings;

        return (
          <div key={index}>
            <div className={styles.ruleRow}>
              <span className={styles.ruleNumber}>{index + 1}.</span>
              <TextInput
                className={styles.ruleQuery}
                placeholder={QUERY_PLACEHOLDER}
                value={rule.query}
                onChange={(event) => patch(index, { query: event.target.value })}
              />
              <Select
                value={rule.action}
                onChange={(event) => patch(index, { action: event.target.value as RuleAction })}
                title={ACTION_EXPLANATION[rule.action]}
              >
                {RULE_ACTIONS.map((action) => (
                  <Select.Option key={action} value={action}>
                    {action}
                  </Select.Option>
                ))}
              </Select>
              <IconButton
                icon={ChevronUpIcon}
                size="small"
                variant="invisible"
                aria-label="Move rule up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              />
              <IconButton
                icon={ChevronDownIcon}
                size="small"
                variant="invisible"
                aria-label="Move rule down"
                disabled={index === rules.length - 1}
                onClick={() => move(index, 1)}
              />
              <IconButton
                icon={XIcon}
                size="small"
                variant="invisible"
                aria-label="Remove rule"
                onClick={() => setRules(rules.filter((_, at) => at !== index))}
              />
            </div>
            {warnings.length > 0 && (
              <Flash variant="warning" className={styles.ruleWarning}>
                {warnings.join("; ")}
              </Flash>
            )}
          </div>
        );
      })}
      <div>
        <Button size="small" onClick={() => setRules([...rules, { query: "", action: "filter" }])}>
          Add rule
        </Button>
      </div>
    </div>
  );
};

interface ViewsViewProps {
  views: View[];
  onChanged: () => void;
}

export const ViewsView: React.FC<ViewsViewProps> = ({ views, onChanged }) => {
  const [editing, setEditing] = useState<number | undefined>(undefined);
  const [name, setName] = useState("");
  const [rules, setRules] = useState<ViewRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const confirm = useConfirm();

  const startEdit = (view: View | undefined) => {
    setEditing(view ? view.id : NEW_VIEW);
    setName(view?.name ?? "");
    setRules(view ? [...view.rules] : [{ query: "", action: "filter" }]);
    setError(undefined);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);

    try {
      if (editing === NEW_VIEW) {
        await api.addView({ name: name.trim(), rules });
      } else if (editing !== undefined) {
        await api.updateView(editing, { name: name.trim(), rules });
      }

      setEditing(undefined);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (view: View) => {
    const confirmed = await confirm({
      title: "Delete view?",
      content: `Delete view "${view.name}"?`,
      confirmButtonContent: "Delete",
      confirmButtonType: "danger",
    });

    if (!confirmed) {
      return;
    }

    setError(undefined);

    try {
      await api.deleteView(view.id);

      if (editing === view.id) {
        setEditing(undefined);
      }

      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const toggleDefault = async (view: View) => {
    setError(undefined);

    try {
      await api.updateView(view.id, { isDefault: !view.isDefault });
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
            <h2>Saved views</h2>
            <CounterLabel>{views.length}</CounterLabel>
            <span className={styles.blurb}>
              "filter" restricts the results. "show", "mute", and "hide" only change how the results are displayed.
              Last match wins
            </span>
          </div>
        </div>
        <div>
          {views.length === 0 && (
            <p className={styles.empty}>No views yet</p>
          )}
          {views.map((view) => (
            <div key={view.id} className={row.item}>
              <div className={row.state}>
                <IconButton
                  icon={view.isDefault ? StarFillIcon : StarIcon}
                  size="small"
                  variant="invisible"
                  aria-label={
                    view.isDefault ? "Default view" : "Set as default"
                  }
                  onClick={() => void toggleDefault(view)}
                />
              </div>
              <div className={row.main}>
                <div className={row.titleLine}>
                  <span className={row.title}>{view.name}</span>
                  <Label size="small" variant="secondary">
                    {view.rules.length} rule{view.rules.length === 1 ? "" : "s"}
                  </Label>
                </div>
              </div>
              <div className={`${row.actions} ${row.actionsVisible}`}>
                <IconButton
                  icon={PencilIcon}
                  size="small"
                  variant="invisible"
                  aria-label={`Edit view ${view.name}`}
                  onClick={() => startEdit(view)}
                />
                <IconButton
                  icon={TrashIcon}
                  size="small"
                  variant="invisible"
                  aria-label={`Delete view ${view.name}`}
                  onClick={() => void remove(view)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={listbox.listbox}>
        <div className={listbox.head}>
          <div className={styles.title}>
            <h2>{editing !== undefined && editing !== NEW_VIEW ? "Edit view" : "New view"}</h2>
          </div>
        </div>
        {editing === undefined ? (
          <div className={styles.empty}>
            <Button onClick={() => startEdit(undefined)}>New view</Button>
          </div>
        ) : (
          <form className={styles.viewForm} onSubmit={(event) => void save(event)}>
            <FormControl required>
              <FormControl.Label>Name</FormControl.Label>
              <TextInput
                placeholder="e.g. Mobile focus"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormControl>
            <RuleEditor rules={rules} setRules={setRules} />
            <div className={styles.viewFormActions}>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !name.trim()}
                loading={busy}
              >
                Save view
              </Button>
              <Button onClick={() => setEditing(undefined)}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
