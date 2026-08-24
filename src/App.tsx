import {
  EyeIcon,
  FlagIcon,
  GearIcon,
  GitPullRequestIcon,
  GraphIcon,
  IssueOpenedIcon,
  PersonIcon,
  RepoIcon,
  SyncIcon,
} from "@primer/octicons-react";
import { Button, Flash, RelativeTime, UnderlineNav } from "@primer/react";
import { useMemo } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { MineView } from "./components/MineView";
import { QueuePage } from "./components/QueuePage";
import { SettingsView } from "./components/SettingsView";
import { SourcesView } from "./components/SourcesView";
import { StatsView } from "./components/StatsView";
import { ViewsView } from "./components/ViewsView";
import { ItemHighlightProvider } from "./itemHighlight";
import { applyRules, filterOptionsFor, groupByBucket } from "./queue";
import { useQueueParams } from "./useQueueParams";
import { useTriage } from "./useTriage";
import styles from "./App.module.scss";

const QUEUE_PATH = "/queue";

const SECTIONS = [
  { path: QUEUE_PATH, label: "Queue", icon: IssueOpenedIcon },
  { path: "/authored", label: "Authored PRs", icon: GitPullRequestIcon },
  { path: "/assigned", label: "Assigned", icon: PersonIcon },
  { path: "/stats", label: "Stats", icon: GraphIcon },
  { path: "/views", label: "Views", icon: EyeIcon },
  { path: "/sources", label: "Sources", icon: RepoIcon },
  { path: "/settings", label: "Settings", icon: GearIcon },
] as const;

export const App: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const triage = useTriage();
  const queue = useQueueParams(triage.views, pathname === QUEUE_PATH);

  const { items } = triage;
  const { filters, hideMuted, sort } = queue;

  const options = useMemo(() => filterOptionsFor(items), [items]);

  const flagged = useMemo(
    () => items.filter((item) => item.flaggedAt && !item.snooze),
    [items],
  );
  const snoozed = useMemo(() => items.filter((item) => item.snooze), [items]);
  const awake = useMemo(() => items.filter((item) => !item.snooze), [items]);

  const showFlagged = () => {
    // Read the live URL rather than the router's: nuqs updates the query string shallowly, so
    // react-router's own `search` doesn't see the filters currently applied
    const params = new URLSearchParams(pathname === QUEUE_PATH ? window.location.search : "");

    params.set("tab", "flagged");
    void navigate(`${QUEUE_PATH}?${params}`);
  };

  const rows = useMemo(() => applyRules(awake, filters, hideMuted), [awake, filters, hideMuted]);
  const byBucket = useMemo(() => groupByBucket(rows.visible, sort), [rows.visible, sort]);

  return (
    <ItemHighlightProvider>
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
            {flagged.length > 0 && (
              <Button
                size="small"
                leadingVisual={FlagIcon}
                className={styles.flagged}
                title="Items requiring your attention"
                onClick={showFlagged}
              >
                {flagged.length} flagged
              </Button>
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

        <UnderlineNav aria-label="Sections" className={styles.nav} hideIconsBreakpoint={null}>
          {SECTIONS.map((section) => (
            <UnderlineNav.Item
              key={section.path}
              as={Link}
              to={section.path}
              aria-current={pathname === section.path ? "page" : undefined}
              leadingVisual={<section.icon />}
              counter={
                section.path === QUEUE_PATH && !triage.loading ? rows.shownCount : undefined
              }
            >
              {section.label}
            </UnderlineNav.Item>
          ))}
        </UnderlineNav>

        {triage.error && (
          <Flash variant="danger" className="shell-flash">
            {triage.error}
          </Flash>
        )}

        <Routes>
          <Route
            path={QUEUE_PATH}
            element={
              <QueuePage
                loading={triage.loading}
                itemCount={items.length}
                views={triage.views}
                queue={queue}
                options={options}
                rows={rows}
                byBucket={byBucket}
                flagged={flagged}
                snoozed={snoozed}
                onSnooze={triage.snooze}
                onWake={triage.wake}
                onFlag={triage.flag}
                onUnflag={triage.unflag}
              />
            }
          />
          <Route path="/authored" element={<MineView sources={triage.sources} section="authored" />} />
          <Route path="/assigned" element={<MineView sources={triage.sources} section="assigned" />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/views" element={<ViewsView views={triage.views} onChanged={triage.reload} />} />
          <Route
            path="/sources"
            element={<SourcesView sources={triage.sources} onChanged={triage.reload} />}
          />
          <Route path="/settings" element={<SettingsView onChanged={triage.reload} />} />
          <Route path="*" element={<Navigate to={QUEUE_PATH} replace />} />
        </Routes>
      </div>
    </ItemHighlightProvider>
  );
};
