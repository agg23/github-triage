import {
  EyeIcon,
  GitPullRequestIcon,
  GraphIcon,
  IssueOpenedIcon,
  PersonIcon,
  RepoIcon,
  SyncIcon,
} from "@primer/octicons-react";
import { Button, Flash, RelativeTime, UnderlineNav } from "@primer/react";
import { useMemo, useState } from "react";
import { MineView } from "./components/MineView";
import { QueuePage } from "./components/QueuePage";
import { SourcesView } from "./components/SourcesView";
import { StatsView } from "./components/StatsView";
import { ViewsView } from "./components/ViewsView";
import { applyRules, filterOptionsFor, groupByBucket } from "./queue";
import type { SortId } from "./types";
import { useStoredFilters } from "./useStoredFilters";
import { useTriage } from "./useTriage";
import styles from "./App.module.scss";

const TABS = [
  { id: "queue", label: "Queue", icon: IssueOpenedIcon },
  { id: "authored", label: "Authored PRs", icon: GitPullRequestIcon },
  { id: "assigned", label: "Assigned", icon: PersonIcon },
  { id: "stats", label: "Stats", icon: GraphIcon },
  { id: "views", label: "Views", icon: EyeIcon },
  { id: "sources", label: "Sources", icon: RepoIcon },
] as const;

type Tab = (typeof TABS)[number]["id"];

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>("queue");
  const [sort, setSort] = useState<SortId>("recent");
  const triage = useTriage();
  const stored = useStoredFilters(triage.views, triage.loading);

  const { items } = triage;
  const { filters, hideMuted } = stored;

  const options = useMemo(() => filterOptionsFor(items), [items]);

  // Snoozed items skip the whole query pipeline and live in their own tab
  const snoozed = useMemo(() => items.filter((item) => item.snooze), [items]);
  const awake = useMemo(() => items.filter((item) => !item.snooze), [items]);

  const rows = useMemo(() => applyRules(awake, filters, hideMuted), [awake, filters, hideMuted]);
  const byBucket = useMemo(() => groupByBucket(rows.visible, sort), [rows.visible, sort]);

  const tabContent: Record<Tab, React.ReactNode> = {
    queue: (
      <QueuePage
        loading={triage.loading}
        itemCount={items.length}
        views={triage.views}
        stored={stored}
        options={options}
        rows={rows}
        byBucket={byBucket}
        snoozed={snoozed}
        sort={sort}
        onSortChange={setSort}
        onSnooze={triage.snooze}
        onWake={triage.wake}
      />
    ),
    authored: <MineView sources={triage.sources} section="authored" />,
    assigned: <MineView sources={triage.sources} section="assigned" />,
    stats: <StatsView />,
    views: <ViewsView views={triage.views} onChanged={triage.reload} />,
    sources: <SourcesView sources={triage.sources} onChanged={triage.reload} />,
  };

  return (
    <div className={styles.shell}>
      <header className={styles.head}>
        <h1>Triage</h1>
        <div className={styles.status}>
          <span>
            {rows.shownCount} shown
            {rows.mutedTotal > 0 ? `, ${rows.mutedTotal} dimmed` : ""} / {items.length} open
          </span>
          {triage.lastSyncedAt && (
            <span>
              synced <RelativeTime datetime={triage.lastSyncedAt} />
            </span>
          )}
          <Button
            size="small"
            leadingVisual={SyncIcon}
            loading={triage.syncing}
            onClick={triage.syncNow}
          >
            Sync now
          </Button>
        </div>
      </header>

      <UnderlineNav aria-label="Sections" className={styles.nav}>
        {TABS.map((navTab) => (
          <UnderlineNav.Item
            key={navTab.id}
            as="button"
            aria-current={tab === navTab.id ? "page" : undefined}
            leadingVisual={<navTab.icon />}
            counter={navTab.id === "queue" && !triage.loading ? rows.shownCount : undefined}
            onSelect={(event) => {
              event.preventDefault();
              setTab(navTab.id);
            }}
          >
            {navTab.label}
          </UnderlineNav.Item>
        ))}
      </UnderlineNav>

      {triage.error && (
        <Flash variant="danger" className="shell-flash">
          {triage.error}
        </Flash>
      )}

      {tabContent[tab]}
    </div>
  );
};
