import { TableIcon } from "@primer/octicons-react";
import { Button, Flash, RelativeTime, SegmentedControl, Spinner } from "@primer/react";
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import { DAY_MS } from "../../shared/constants";
import type { ItemType } from "../../shared/types";
import { fetchRepoLabels, fetchStats, type StatsResponse } from "../statsData";
import {
  bucketClassTotal,
  CLASS_LABEL,
  classColor,
  CONTRIB_CLASSES,
  DEFAULT_PRESET_ID,
  PRESET_IDS,
  PRESETS,
  SCOPES,
  scopeLabel,
  TYPE_COLOR,
  typesForScope,
} from "../stats";
import filterStyles from "./Filters.module.scss";
import { FilterSelectPanel } from "./FilterSelectPanel";
import { type ChartSeries, Legend, LineChart } from "./LineChart";
import { SeriesTable } from "./SeriesTable";
import { BacklogTile, Tile } from "./StatsTiles";
import styles from "./StatsView.module.scss";

const BACKLOG_TYPES: ItemType[] = ["issue", "pr"];

const BACKLOG_LABEL: Record<ItemType, string> = {
  issue: "Issues",
  pr: "PRs",
};

const METRICS = ["opened", "open"] as const;

const statsParsers = {
  metric: parseAsStringLiteral(METRICS).withDefault("opened"),
  range: parseAsStringLiteral(PRESET_IDS).withDefault(DEFAULT_PRESET_ID),
  scope: parseAsStringLiteral(SCOPES).withDefault("all"),
  label: parseAsString.withDefault(""),
  table: parseAsBoolean.withDefault(false),
};

export const StatsView: React.FC = () => {
  const [params, setParams] = useQueryStates(statsParsers, { history: "push" });
  const [labels, setLabels] = useState<string[]>([]);

  const { metric, range, scope, label, table: showTable } = params;

  const [data, setData] = useState<StatsResponse | undefined>(undefined);
  const [loadedAt, setLoadedAt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const preset = PRESETS.find((candidate) => candidate.id === range) ?? PRESETS[0];

  useEffect(() => {
    let cancelled = false;

    fetchRepoLabels()
      .then((loaded) => !cancelled && setLabels(loaded))
      .catch(() => !cancelled && setLabels([]));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(undefined);

      try {
        const now = Date.now();
        const response = await fetchStats(now - preset.days * DAY_MS, now, preset.granularity, {
          label: label || undefined,
          metric,
        });

        if (cancelled) {
          return;
        }

        setData(response);
        setLoadedAt(new Date().toISOString());
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [preset, label, metric]);

  const stats = data?.stats;
  const buckets = stats?.buckets ?? [];
  const isBacklog = metric === "open";
  const labelActive = label !== "";

  const flowSeries: ChartSeries[] = CONTRIB_CLASSES.map((actorClass) => ({
    key: actorClass,
    label: CLASS_LABEL[actorClass],
    color: classColor(actorClass),
    values: buckets.map((bucket) => bucketClassTotal(bucket, typesForScope(scope), actorClass)),
  }));
  const backlogSeries: ChartSeries[] = BACKLOG_TYPES.map((type) => ({
    key: type,
    label: BACKLOG_LABEL[type],
    color: TYPE_COLOR[type],
    values: buckets.map((bucket) => bucket.openByType?.[type] ?? 0),
  }));
  const chartSeries = isBacklog ? backlogSeries : flowSeries;
  const xLabels = buckets.map((bucket) => bucket.label);

  const ready = !!stats && data && data.metric === metric;

  const tableButtonClass = showTable
    ? `${filterStyles.button} ${filterStyles.buttonActive}`
    : filterStyles.button;

  const labelNote = label && <span className={styles.captionLabel}> · {label}</span>;
  const caption = isBacklog ? (
    <>
      Open issues &amp; PRs{labelNote} at the end of each period
    </>
  ) : (
    <>
      {scopeLabel(scope)}
      {labelNote} over time, one line per contributor class
    </>
  );
  const chartAriaLabel = isBacklog
    ? `Open issues and PRs at the end of each of ${xLabels.length} periods`
    : `${scopeLabel(scope)} opened over ${xLabels.length} periods, one line per class`;

  return (
    <div className={styles.vizRoot}>
      <div className={styles.bar}>
        <SegmentedControl
          aria-label="Metric"
          size="small"
          onChange={(index) => void setParams({ metric: METRICS[index] })}
        >
          <SegmentedControl.Button selected={metric === "opened"}>Opened</SegmentedControl.Button>
          <SegmentedControl.Button selected={metric === "open"}>
            Open backlog
          </SegmentedControl.Button>
        </SegmentedControl>
        <SegmentedControl
          aria-label="Time range"
          size="small"
          onChange={(index) => void setParams({ range: PRESETS[index].id })}
        >
          {PRESETS.map((candidate) => (
            <SegmentedControl.Button key={candidate.id} selected={candidate.id === range}>
              {candidate.label}
            </SegmentedControl.Button>
          ))}
        </SegmentedControl>
        <span className={styles.granularity}>
          {preset.granularity === "week" ? "weekly" : "monthly"} buckets
        </span>
        <div className={styles.barRight}>
          <FilterSelectPanel
            label="Label"
            value={label}
            options={labels}
            onChange={(next) => void setParams({ label: next })}
          />
          <Button
            size="small"
            variant="invisible"
            className={tableButtonClass}
            leadingVisual={TableIcon}
            aria-pressed={showTable}
            onClick={() => void setParams({ table: !showTable })}
          >
            Table
          </Button>
        </div>
      </div>

      {error && (
        <Flash variant="danger" className="shell-flash">
          {error}
        </Flash>
      )}

      {loading && !ready && (
        <div className="loading-center">
          <Spinner />
          <p>
            {isBacklog ? "Computing the open backlog" : "Counting everything opened"} across watched
            sources over the {preset.label.toLowerCase()}…
          </p>
        </div>
      )}

      {ready && stats && data && (
        <>
          {data.coveredSince && (
            <Flash variant="warning" className={styles.note}>
              The cache only reaches back to {new Date(data.coveredSince).toLocaleDateString()}, so
              counts for earlier periods are incomplete. Re-add a source with more backfill days to
              extend coverage.
            </Flash>
          )}

          {isBacklog ? (
            <div className={`${styles.tiles} ${styles.tiles2}`}>
              {backlogSeries.map((series) => (
                <BacklogTile
                  key={series.key}
                  label={series.label}
                  color={series.color}
                  values={series.values}
                />
              ))}
            </div>
          ) : (
            <div className={labelActive ? `${styles.tiles} ${styles.tiles3}` : styles.tiles}>
              {SCOPES.map((candidate) => (
                <Tile
                  key={candidate}
                  scope={candidate}
                  types={typesForScope(candidate)}
                  selected={candidate === scope}
                  buckets={stats.buckets}
                  onSelect={() => void setParams({ scope: candidate })}
                />
              ))}
            </div>
          )}

          <Legend series={chartSeries} />

          <div className={loading ? `${styles.chartArea} ${styles.loading}` : styles.chartArea}>
            {loading && (
              <div className={styles.loadingBadge}>
                <Spinner size="small" /> Loading {preset.label.toLowerCase()}…
              </div>
            )}
            <LineChart
              series={chartSeries}
              xLabels={xLabels}
              unitNoun={isBacklog ? "open" : "opened"}
              caption={caption}
              ariaLabel={chartAriaLabel}
            />
          </div>

          {showTable && (
            <SeriesTable series={chartSeries} xLabels={xLabels} rowTotal footer={!isBacklog} />
          )}

          <div className={styles.foot}>
            <span>computed from the local cache</span>
            {loadedAt && (
              <span>
                · updated <RelativeTime datetime={loadedAt} />
              </span>
            )}
            {isBacklog ? (
              <>
                <span>
                  · open issues/PRs as of each period end
                </span>
                {labelActive && <span>· label-filtered</span>}
              </>
            ) : (
              <>
                <span>· open, closed, and merged by creation date</span>
                <span>· "external" includes bot-opened items</span>
                {labelActive && <span>· label filters issues and PRs</span>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
