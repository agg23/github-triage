import { RepoIcon } from "@primer/octicons-react";
import { Spinner } from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { serializeRules } from "../../shared/query";
import type { View } from "../../shared/types";
import type { QueueRows } from "../queue";
import type { BucketId, FilterOptions, SnoozeChoice, TriageItem } from "../types";
import type { QueueParams } from "../useQueueParams";
import { FilterMenus } from "./FilterMenus";
import { QueueList } from "./QueueList";
import { SearchBar } from "./SearchBar";

interface QueuePageProps {
  loading: boolean;
  itemCount: number;
  views: View[];
  queue: QueueParams;
  options: FilterOptions;
  rows: QueueRows;
  byBucket: Map<BucketId, TriageItem[]>;
  flagged: TriageItem[];
  snoozed: TriageItem[];
  onSnooze: (item: TriageItem, choice: SnoozeChoice) => void;
  onWake: (item: TriageItem) => void;
  onFlag: (item: TriageItem) => void;
  onUnflag: (item: TriageItem) => void;
}

export const QueuePage: React.FC<QueuePageProps> = ({
  loading,
  itemCount,
  views,
  queue,
  options,
  rows,
  byBucket,
  flagged,
  snoozed,
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
      <SearchBar
        filters={queue.filters}
        setFilters={queue.setFilters}
        setSearch={queue.setSearch}
        views={views}
      />
      <main>
        <QueueList
          filterMenus={
            <FilterMenus
              filters={queue.filters}
              setFilters={queue.setFilters}
              options={options}
              baselineQuery={serializeRules(defaultView?.rules ?? [])}
            />
          }
          byBucket={byBucket}
          flagged={flagged}
          snoozed={snoozed}
          activeTab={queue.tab}
          onTabChange={queue.setTab}
          showRepo={options.repos.length > 1}
          hideBots={queue.filters.hideBots}
          sort={queue.sort}
          onSortChange={queue.setSort}
          mutedTotal={rows.mutedTotal}
          hideMuted={queue.hideMuted}
          onToggleMuted={queue.toggleMuted}
          onSnooze={onSnooze}
          onWake={onWake}
          onFlag={onFlag}
          onUnflag={onUnflag}
        />
      </main>
    </>
  );
};
