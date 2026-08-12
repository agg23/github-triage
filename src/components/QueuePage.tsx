import { RepoIcon } from "@primer/octicons-react";
import { Spinner } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { serializeRules } from "../../shared/query";
import type { View } from "../../shared/types";
import type { QueueRows } from "../queue";
import type {
  BucketId,
  FilterOptions,
  QueueTab,
  SnoozeChoice,
  SortId,
  TriageItem,
} from "../types";
import type { StoredFilters } from "../useStoredFilters";
import { FilterMenus } from "./FilterMenus";
import { QueueList } from "./QueueList";
import { SearchBar } from "./SearchBar";

interface QueuePageProps {
  loading: boolean;
  itemCount: number;
  views: View[];
  stored: StoredFilters;
  options: FilterOptions;
  rows: QueueRows;
  byBucket: Map<BucketId, TriageItem[]>;
  flagged: TriageItem[];
  snoozed: TriageItem[];
  activeTab: QueueTab;
  onTabChange: (tab: QueueTab) => void;
  sort: SortId;
  onSortChange: (sort: SortId) => void;
  onSnooze: (item: TriageItem, choice: SnoozeChoice) => void;
  onWake: (item: TriageItem) => void;
  onFlag: (item: TriageItem) => void;
  onUnflag: (item: TriageItem) => void;
}

export const QueuePage: React.FC<QueuePageProps> = ({
  loading,
  itemCount,
  views,
  stored,
  options,
  rows,
  byBucket,
  flagged,
  snoozed,
  activeTab,
  onTabChange,
  sort,
  onSortChange,
  onSnooze,
  onWake,
  onFlag,
  onUnflag,
}) => {
  if (loading) {
    return (
      <div className="loading-center">
        <Spinner />
        <p>Loading cached items…</p>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <Blankslate>
        <Blankslate.Visual>
          <RepoIcon size={24} />
        </Blankslate.Visual>
        <Blankslate.Heading>No items cached yet</Blankslate.Heading>
        <Blankslate.Description>
          Add a source in the Sources tab, then press “Sync now”.
        </Blankslate.Description>
      </Blankslate>
    );
  }

  const defaultView = views.find((view) => view.isDefault);

  return (
    <>
      <SearchBar filters={stored.filters} setFilters={stored.setFilters} views={views} />
      <main>
        <QueueList
          filterMenus={
            <FilterMenus
              filters={stored.filters}
              setFilters={stored.setFilters}
              options={options}
              baselineQuery={serializeRules(defaultView?.rules ?? [])}
            />
          }
          byBucket={byBucket}
          flagged={flagged}
          snoozed={snoozed}
          activeTab={activeTab}
          onTabChange={onTabChange}
          showRepo={options.repos.length > 1}
          hideBots={stored.filters.hideBots}
          sort={sort}
          onSortChange={onSortChange}
          mutedTotal={rows.mutedTotal}
          hideMuted={stored.hideMuted}
          onToggleMuted={stored.toggleMuted}
          onSnooze={onSnooze}
          onWake={onWake}
          onFlag={onFlag}
          onUnflag={onUnflag}
        />
      </main>
    </>
  );
};
