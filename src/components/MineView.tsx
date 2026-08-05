import { CheckIcon, GitPullRequestIcon, IssueOpenedIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu, Flash, Spinner } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useEffect, useMemo, useState } from "react";
import type { Item, ItemState } from "../../shared/types";
import { api, type SourceWithCount } from "../api";
import { CONFIG } from "../config";
import { enrich } from "../triage";
import { ItemRow } from "./ItemRow";
import listbox from "./QueueList.module.scss";

type StateFilter = "open" | "closed";

type MineSort = "updated" | "created";

const SORT_LABEL: Record<MineSort, string> = {
  updated: "Last updated",
  created: "Created",
};

const FETCH_LIMIT = "300";

export type MineSection = "authored" | "assigned";

interface SectionMetadata {
  openIcon: React.FunctionComponent<{ size?: number }>;
  blurb: string;
  params: Record<string, string>;
}

const SECTION_METADATA: Record<MineSection, SectionMetadata> = {
  authored: {
    openIcon: GitPullRequestIcon,
    blurb: `Pull requests opened by ${CONFIG.me}`,
    params: { author: CONFIG.me, type: "pr" },
  },
  assigned: {
    openIcon: IssueOpenedIcon,
    blurb: `Issues and pull requests assigned to ${CONFIG.me}`,
    params: { assignee: CONFIG.me },
  },
};

interface MineViewProps {
  sources: SourceWithCount[];
  section: MineSection;
}

export const MineView: React.FC<MineViewProps> = ({ sources, section }) => {
  const [state, setState] = useState<StateFilter>("open");
  const [sort, setSort] = useState<MineSort>("updated");
  const [fetched, setFetched] = useState<Record<StateFilter, Item[]> | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const { params } = SECTION_METADATA[section];

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
  }, [section]);

  const priorityBySource = useMemo(
    () => new Map(sources.map((source) => [source.id, source.priority])),
    [sources],
  );

  const items = useMemo(() => {
    if (!fetched) {
      return undefined;
    }

    const noSnooze = new Map<string, ItemState>();
    const timeOf = (item: Item) => (sort === "created" ? item.createdAt : item.lastActivityAt);

    return fetched[state]
      .map((item) => enrich(item, priorityBySource, noSnooze))
      .sort((first, second) => timeOf(second).localeCompare(timeOf(first)));
  }, [fetched, state, sort, priorityBySource]);

  const OpenIcon = SECTION_METADATA[section].openIcon;
  const stateTab = (stateId: StateFilter) =>
    stateId === state ? `${listbox.tab} ${listbox.active}` : listbox.tab;

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
              onClick={() => setState("open")}
            >
              <OpenIcon size={16} />
              {(fetched?.open.length ?? 0).toLocaleString()} Open
            </button>
            <button
              className={stateTab("closed")}
              aria-current={state === "closed" || undefined}
              onClick={() => setState("closed")}
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
                  {(Object.keys(SORT_LABEL) as MineSort[]).map((sortId) => (
                    <ActionList.Item
                      key={sortId}
                      selected={sort === sortId}
                      onSelect={() => setSort(sortId)}
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
                {`${SECTION_METADATA[section].blurb} (${state})`}
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
