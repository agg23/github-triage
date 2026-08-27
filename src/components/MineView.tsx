import { CheckIcon, GitPullRequestIcon, IssueOpenedIcon, PersonIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu, Flash, Spinner } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import type { Item, ItemState } from "../../shared/types";
import { api, type SourceWithCount } from "../api";
import { useSettings } from "../settings";
import { enrich } from "../triage";
import { ItemRow } from "./ItemRow";
import listbox from "./QueueList.module.scss";

const STATE_FILTERS = ["open", "closed"] as const;
type StateFilter = (typeof STATE_FILTERS)[number];

const MINE_SORTS = ["updated", "created"] as const;
type MineSort = (typeof MINE_SORTS)[number];

const SORT_LABEL: Record<MineSort, string> = {
  updated: "Last updated",
  created: "Created",
};

const mineParsers = {
  state: parseAsStringLiteral(STATE_FILTERS).withDefault("open"),
  sort: parseAsStringLiteral(MINE_SORTS).withDefault("updated"),
};

const FETCH_LIMIT = "300";

export type MineSection = "authored" | "assigned";

interface SectionMetadata {
  openIcon: React.FunctionComponent<{ size?: number }>;
  blurb: string;
  params: Record<string, string>;
}

const sectionMetadata = (me: string): Record<MineSection, SectionMetadata> => ({
  authored: {
    openIcon: GitPullRequestIcon,
    blurb: `Pull requests opened by ${me}`,
    params: { author: me, type: "pr" },
  },
  assigned: {
    openIcon: IssueOpenedIcon,
    blurb: `Issues and pull requests assigned to ${me}`,
    params: { assignee: me },
  },
});

interface MineViewProps {
  sources: SourceWithCount[];
  section: MineSection;
}

export const MineView: React.FC<MineViewProps> = ({ sources, section }) => {
  const { me } = useSettings();
  const metadata = useMemo(() => sectionMetadata(me)[section], [me, section]);
  const [{ state, sort }, setParams] = useQueryStates(mineParsers, { history: "push" });
  const [fetched, setFetched] = useState<Record<StateFilter, Item[]> | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const { params } = metadata;

    if (!me) {
      return;
    }

    setFetched(undefined);
    setError(undefined);

    Promise.all([
      api.items({ ...params, state: "open", limit: FETCH_LIMIT }),
      api.items({ ...params, state: "closed", limit: FETCH_LIMIT }),
    ])
      .then(([open, closed]) => {
        if (!cancelled) {
          setFetched({ open, closed });
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [me, metadata]);

  const priorityBySource = useMemo(
    () => new Map(sources.map((source) => [source.id, source.priority])),
    [sources],
  );

  const items = useMemo(() => {
    if (!fetched) {
      return undefined;
    }

    const noItemState = new Map<string, ItemState>();
    const timeOf = (item: Item) => (sort === "created" ? item.createdAt : item.activityAt);

    return fetched[state]
      .map((item) => enrich(item, priorityBySource, noItemState))
      .sort((first, second) => timeOf(second).localeCompare(timeOf(first)));
  }, [fetched, state, sort, priorityBySource]);

  const OpenIcon = metadata.openIcon;
  const stateTab = (stateId: StateFilter) =>
    stateId === state ? `${listbox.tab} ${listbox.active}` : listbox.tab;

  if (!me) {
    return (
      <main>
        <Blankslate>
          <Blankslate.Visual>
            <PersonIcon size={24} />
          </Blankslate.Visual>
          <Blankslate.Heading>No account set</Blankslate.Heading>
          <Blankslate.Description>
            Set your GitHub username in Settings.
          </Blankslate.Description>
        </Blankslate>
      </main>
    );
  }

  return (
    <main>
      {error && (
        <Flash variant="danger" className="shell-flash">
          {error}
        </Flash>
      )}

      <div className={listbox.listbox}>
        <div className={listbox.head}>
          <div className={listbox.tabs}>
            <button
              className={stateTab("open")}
              aria-current={state === "open" || undefined}
              onClick={() => void setParams({ state: "open" })}
            >
              <OpenIcon size={16} />
              {(fetched?.open.length ?? 0).toLocaleString()} Open
            </button>
            <button
              className={stateTab("closed")}
              aria-current={state === "closed" || undefined}
              onClick={() => void setParams({ state: "closed" })}
            >
              <CheckIcon size={16} />
              {(fetched?.closed.length ?? 0).toLocaleString()} Closed
            </button>
          </div>
          <div className={listbox.sorting}>
            <ActionMenu>
              <ActionMenu.Button variant="invisible" size="small">
                Sort: {SORT_LABEL[sort]}
              </ActionMenu.Button>
              <ActionMenu.Overlay align="end">
                <ActionList selectionVariant="single">
                  {MINE_SORTS.map((sortId) => (
                    <ActionList.Item
                      key={sortId}
                      selected={sort === sortId}
                      onSelect={() => void setParams({ sort: sortId })}
                    >
                      {SORT_LABEL[sortId]}
                    </ActionList.Item>
                  ))}
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
          </div>
        </div>

        <div>
          {items === undefined ? (
            !error && (
              <div className="loading-center">
                <Spinner />
                <p>Loading…</p>
              </div>
            )
          ) : items.length === 0 ? (
            <Blankslate>
              <Blankslate.Visual>
                <CheckIcon size={24} />
              </Blankslate.Visual>
              <Blankslate.Heading>Nothing here</Blankslate.Heading>
              <Blankslate.Description>
                {`${metadata.blurb} (${state})`}
              </Blankslate.Description>
            </Blankslate>
          ) : (
            items.map((item) => <ItemRow key={item.id} item={item} showRepo />)
          )}
        </div>
      </div>
    </main>
  );
};
