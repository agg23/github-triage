import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  DotFillIcon,
  EyeClosedIcon,
  EyeIcon,
  FlagIcon,
  HourglassIcon,
  ZapIcon,
} from "@primer/octicons-react";
import { ActionList, ActionMenu, Button, CounterLabel } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { comparatorFor } from "../queue";
import {
  type BucketId,
  QUEUE_TABS,
  type QueueTab,
  type SnoozeChoice,
  SORT_IDS,
  type SortId,
  type TriageItem,
} from "../types";
import { ItemRow } from "./ItemRow";
import styles from "./QueueList.module.scss";

interface TabMetadata {
  label: string;
  icon: React.FunctionComponent<{ size?: number }>;
  blurb: string;
}

const TAB_METADATA: Record<QueueTab, TabMetadata> = {
  attention: { label: "Attention", icon: AlertIcon, blurb: "Awaiting our interaction" },
  new: { label: "New", icon: DotFillIcon, blurb: "Freshly opened and not triaged" },
  waiting: { label: "Waiting", icon: HourglassIcon, blurb: "A team member replied last. Waiting on third party" },
  bot: { label: "Bots", icon: ZapIcon, blurb: "Last changed by a bot" },
  flagged: {
    label: "Flagged",
    icon: FlagIcon,
    blurb: "Requires attention",
  },
  snoozed: {
    label: "Snoozed",
    icon: ClockIcon,
    blurb: "Hidden until a wake time passes or new activity arrives.",
  },
};

const SORT_LABEL: Record<SortId, string> = {
  recent: "Last updated",
  created: "Created",
  priority: "Source priority",
};

const NO_WAKE_TIME = "9999";

interface QueueListProps {
  byBucket: Map<BucketId, TriageItem[]>;
  flagged: TriageItem[];
  snoozed: TriageItem[];
  activeTab: QueueTab;
  onTabChange: (tab: QueueTab) => void;
  showRepo: boolean;
  hideBots: boolean;
  sort: SortId;
  onSortChange: (sort: SortId) => void;
  mutedTotal: number;
  hideMuted: boolean;
  onToggleMuted: () => void;
  onSnooze: (item: TriageItem, choice: SnoozeChoice) => void;
  onWake: (item: TriageItem) => void;
  onFlag: (item: TriageItem) => void;
  onUnflag: (item: TriageItem) => void;
  filterMenus?: React.ReactNode;
}

export const QueueList: React.FC<QueueListProps> = ({
  byBucket,
  flagged,
  snoozed,
  activeTab,
  onTabChange,
  showRepo,
  hideBots,
  sort,
  onSortChange,
  mutedTotal,
  hideMuted,
  onToggleMuted,
  onSnooze,
  onWake,
  onFlag,
  onUnflag,
  filterMenus,
}) => {
  const tab: QueueTab = hideBots && activeTab === "bot" ? "attention" : activeTab;

  const tabs = QUEUE_TABS.filter((tabId) => !(tabId === "bot" && hideBots));

  // Dimmed/muted rows don't show in the count
  const countOf = (tabId: QueueTab) => {
    switch (tabId) {
      case "flagged":
        return flagged.length;
      case "snoozed":
        return snoozed.length;
      default:
        return byBucket.get(tabId)?.filter((item) => item.mutedBy === undefined).length ?? 0;
    }
  };

  const wakeTimeOf = (item: TriageItem) => item.snooze?.wakeAt ?? NO_WAKE_TIME;

  const itemsFor = (tabId: QueueTab): TriageItem[] => {
    switch (tabId) {
      case "flagged":
        return [...flagged].sort(comparatorFor(sort));
      case "snoozed":
        return [...snoozed].sort((first, second) => wakeTimeOf(first).localeCompare(wakeTimeOf(second)));
      default:
        return byBucket.get(tabId) ?? [];
    }
  };

  const items = itemsFor(tab);

  const rowActions =
    tab === "snoozed" ? { onWake, onFlag, onUnflag } : { onSnooze, onFlag, onUnflag };

  return (
    <div className={styles.listbox}>
      <div className={styles.head}>
        <div className={styles.tabs}>
          {tabs.map((tabId) => {
            const meta = TAB_METADATA[tabId];
            const Icon = meta.icon;
            const classNames = [styles.tab];

            if (tabId === tab) {
              classNames.push(styles.active);
            }

            return (
              <button
                key={tabId}
                className={classNames.join(" ")}
                title={meta.blurb}
                aria-current={tabId === tab || undefined}
                onClick={() => onTabChange(tabId)}
              >
                <Icon size={16} />
                {meta.label}
                <CounterLabel className={styles.counter}>{countOf(tabId)}</CounterLabel>
              </button>
            );
          })}
        </div>
        <div className={styles.actions}>
          {filterMenus}
          <div className={styles.sorting}>
            {mutedTotal > 0 && (
              <Button
                variant="invisible"
                size="small"
                leadingVisual={hideMuted ? EyeIcon : EyeClosedIcon}
                title={hideMuted ? "Show muted items" : "Hide muted items"}
                onClick={onToggleMuted}
              >
                {hideMuted ? "Show" : "Hide"} muted ({mutedTotal})
              </Button>
            )}
            <ActionMenu>
              <ActionMenu.Button variant="invisible" size="small">
                Sort: {SORT_LABEL[sort]}
              </ActionMenu.Button>
              <ActionMenu.Overlay align="end">
                <ActionList selectionVariant="single">
                  {SORT_IDS.map((sortId) => (
                    <ActionList.Item
                      key={sortId}
                      selected={sort === sortId}
                      onSelect={() => onSortChange(sortId)}
                    >
                      {SORT_LABEL[sortId]}
                    </ActionList.Item>
                  ))}
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
          </div>
        </div>
      </div>

      <div>
        {items.length === 0 ? (
          <Blankslate>
            <Blankslate.Visual>
              <CheckCircleIcon size={24} />
            </Blankslate.Visual>
            <Blankslate.Heading>Nothing here</Blankslate.Heading>
            <Blankslate.Description>{TAB_METADATA[tab].blurb}</Blankslate.Description>
          </Blankslate>
        ) : (
          items.map((item) => (
            <ItemRow key={item.id} item={item} showRepo={showRepo} {...rowActions} />
          ))
        )}
      </div>
    </div>
  );
};
