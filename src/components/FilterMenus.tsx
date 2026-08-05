import { XIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu, Button } from "@primer/react";
import { useMemo } from "react";
import { DAY_MS } from "../../shared/constants";
import {
  getQualifier,
  parseQuery,
  type QueryTerm,
  quoteValue,
  rewriteQuery,
  setWindowQuery,
  windowQuery,
} from "../../shared/query";
import { CONFIG } from "../config";
import { DEFAULT_FILTERS, type FilterOptions, type Filters } from "../types";
import { FilterSelectPanel } from "./FilterSelectPanel";
import styles from "./Filters.module.scss";

type TypeChoice = "all" | "issue" | "pr";

interface Choice<T> {
  label: string;
  value: T;
}

const TYPE_CHOICES: Choice<TypeChoice>[] = [
  { label: "All types", value: "all" },
  { label: "Issues", value: "issue" },
  { label: "Pull requests", value: "pr" },
];

const AGE_CHOICES: Choice<number>[] = [
  { label: "Any age", value: 0 },
  { label: "> 1 day", value: 1 },
  { label: "> 1 week", value: 7 },
  { label: "> 1 month", value: 30 },
  { label: "> 3 months", value: 90 },
];

// Marks an age filter we didn't write, so the button reads active with no preset
const CUSTOM_AGE = -1;

const dateDaysAgo = (days: number) =>
  new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

const isTypeTerm = (term: QueryTerm) =>
  !term.negated &&
  (term.qualifier === "type" ||
    (term.qualifier === "is" && (term.value === "issue" || term.value === "pr")));

interface MenuFilterProps<T extends string | number> {
  label: string;
  value: T;
  active: boolean;
  choices: Choice<T>[];
  onChange: (value: T) => void;
}

/**
* A constant label, single-select menu
*/
const MenuFilter = <T extends string | number>({
  label,
  value,
  active,
  choices,
  onChange,
}: MenuFilterProps<T>) => (
  <ActionMenu>
    <ActionMenu.Button
      variant="invisible"
      size="small"
      className={active ? `${styles.button} ${styles.buttonActive}` : styles.button}
    >
      {label}
    </ActionMenu.Button>
    <ActionMenu.Overlay>
      <ActionList selectionVariant="single">
        {choices.map((choice) => (
          <ActionList.Item
            key={String(choice.value)}
            selected={choice.value === value}
            onSelect={() => onChange(choice.value)}
          >
            {choice.label}
          </ActionList.Item>
        ))}
      </ActionList>
    </ActionMenu.Overlay>
  </ActionMenu>
);

interface WindowValues {
  type: TypeChoice;
  repo: string;
  label: string;
  author: string;
  assignee: string;
  person: string;
  ageDays: number;
}

interface FilterMenusProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  options: FilterOptions;
  /** What "Clear" returns to: the default view's rules, or "" */
  baselineQuery: string;
}

/**
* Filters for the list box header
*/
export const FilterMenus: React.FC<FilterMenusProps> = ({
  filters,
  setFilters,
  options,
  baselineQuery,
}) => {
  const patch = (partial: Partial<Filters>) => setFilters({ ...filters, ...partial });
  const baseline: Filters = { ...DEFAULT_FILTERS, query: baselineQuery };
  const dirty = JSON.stringify(filters) !== JSON.stringify(baseline);

  const windowText = windowQuery(filters.query);
  const setWindowText = (body: string) =>
    setFilters({ ...filters, query: setWindowQuery(filters.query, body) });

  const current = useMemo(() => readWindow(windowText), [windowText]);

  // Replace every non-negated `qualifier:` term with `qualifier:value`, or drop it
  const setSimple = (qualifier: string, value: string) =>
    setWindowText(
      rewriteQuery(
        windowText,
        (term) => !term.negated && term.qualifier === qualifier,
        value ? [`${qualifier}:${quoteValue(value)}`] : [],
      ),
    );

  const setType = (type: TypeChoice) =>
    setWindowText(rewriteQuery(windowText, isTypeTerm, type === "all" ? [] : [`is:${type}`]));

  const setAge = (days: number) =>
    setWindowText(
      rewriteQuery(
        windowText,
        (term) => !term.negated && term.qualifier === "created",
        days === 0 ? [] : [`created:<${dateDaysAgo(days)}`],
      ),
    );

  return (
    <div className={styles.buttons}>
      <MenuFilter
        label="Type"
        value={current.type}
        active={current.type !== "all"}
        choices={TYPE_CHOICES}
        onChange={setType}
      />
      {options.repos.length > 1 && (
        <MenuFilter
          label="Repo"
          value={current.repo}
          active={current.repo !== ""}
          choices={[
            { label: "All repos", value: "" },
            ...options.repos.map((repo) => ({ label: repo, value: repo })),
          ]}
          onChange={(repo) => setSimple("repo", repo)}
        />
      )}
      <FilterSelectPanel
        label="Label"
        value={current.label}
        options={options.labels}
        onChange={(label) => setSimple("label", label)}
      />
      <FilterSelectPanel
        label="Author"
        value={current.author}
        options={options.authors}
        onChange={(author) => setSimple("author", author)}
      />
      <FilterSelectPanel
        label="Assignee"
        value={current.assignee}
        options={options.assignees}
        onChange={(assignee) => setSimple("assignee", assignee)}
      />
      <FilterSelectPanel
        label="Person"
        value={current.person}
        options={options.people}
        onChange={(person) => setSimple("involves", person)}
      />
      <MenuFilter
        label="Age"
        value={current.ageDays}
        active={current.ageDays !== 0}
        choices={AGE_CHOICES}
        onChange={setAge}
      />

      <ActionMenu>
        <ActionMenu.Button variant="invisible" size="small" className={styles.button}>
          More
        </ActionMenu.Button>
        <ActionMenu.Overlay align="end">
          <ActionList selectionVariant="multiple">
            {CONFIG.me && (
              <ActionList.Item
                selected={filters.forMe}
                onSelect={() => patch({ forMe: !filters.forMe })}
              >
                For me
                <ActionList.Description variant="block">
                  Authored by, review requested from, assigned to, or involving {CONFIG.me}
                </ActionList.Description>
              </ActionList.Item>
            )}
            <ActionList.Item
              selected={filters.hideBots}
              onSelect={() => patch({ hideBots: !filters.hideBots })}
            >
              Hide bots
            </ActionList.Item>
            <ActionList.Item
              selected={filters.hideDrafts}
              onSelect={() => patch({ hideDrafts: !filters.hideDrafts })}
            >
              Hide drafts
            </ActionList.Item>
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>

      <Button
        variant="invisible"
        size="small"
        leadingVisual={XIcon}
        style={{ visibility: dirty ? "visible" : "hidden" }}
        onClick={() => setFilters(baseline)}
      >
        Clear
      </Button>
    </div>
  );
};

const readWindow = (windowText: string): WindowValues => {
  const typeTerm = parseQuery(windowText).terms.find(isTypeTerm);

  return {
    type: (typeTerm?.value ?? "all") as TypeChoice,
    repo: getQualifier(windowText, "repo"),
    label: getQualifier(windowText, "label"),
    author: getQualifier(windowText, "author"),
    assignee: getQualifier(windowText, "assignee"),
    person: getQualifier(windowText, "involves"),
    ageDays: ageDaysIn(getQualifier(windowText, "created")),
  };
};

const ageDaysIn = (created: string): number => {
  // The dropdown only writes `created:<YYYY-MM-DD`, so anything else it finds is hand-typed and has no preset to highlight
  const before = /^<(\d{4}-\d{2}-\d{2})$/.exec(created);

  if (before) {
    return Math.round((Date.now() - new Date(`${before[1]}T00:00:00Z`).getTime()) / DAY_MS);
  }

  if (created) {
    return CUSTOM_AGE;
  }

  return 0;
};
