import type { ItemType } from "../../shared/types";
import {
  type Bucket,
  bucketClassTotal,
  CLASS_LABEL,
  classColor,
  CONTRIB_CLASSES,
  type Scope,
  scopeLabel,
} from "../stats";
import type { ActorClass } from "../types";
import styles from "./StatsView.module.scss";

interface ClassTotal {
  actorClass: ActorClass;
  count: number;
}

interface TileProps {
  scope: Scope;
  types: ItemType[];
  selected: boolean;
  buckets: Bucket[];
  onSelect: () => void;
}

export const Tile: React.FC<TileProps> = ({ scope, types, selected, buckets, onSelect }) => {
  const perClass: ClassTotal[] = CONTRIB_CLASSES.map((actorClass) => ({
    actorClass,
    count: buckets.reduce((sum, bucket) => sum + bucketClassTotal(bucket, types, actorClass), 0),
  }));
  const total = perClass.reduce((sum, entry) => sum + entry.count, 0);
  const external = perClass.find((entry) => entry.actorClass === "external")?.count ?? 0;
  const externalShare = total > 0 ? Math.round((external / total) * 100) : 0;

  return (
    <button
      className={selected ? `${styles.tile} ${styles.selected}` : styles.tile}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.tileLabel}>{scopeLabel(scope)}</span>
      <span className={styles.tileNumber}>{total.toLocaleString()}</span>
      <span className={styles.tileMeter} aria-hidden="true">
        {perClass.map(
          (entry) =>
            entry.count > 0 && (
              <span
                key={entry.actorClass}
                className={styles.meterSegment}
                style={{ flexGrow: entry.count, background: classColor(entry.actorClass) }}
                title={`${CLASS_LABEL[entry.actorClass]}: ${entry.count}`}
              />
            ),
        )}
      </span>
      <span className={styles.tileSub}>{externalShare}% external</span>
    </button>
  );
};

interface BacklogTileProps {
  label: string;
  color: string;
  values: number[];
}

export const BacklogTile: React.FC<BacklogTileProps> = ({ label, color, values }) => {
  const end = values[values.length - 1] ?? 0;
  const delta = end - (values[0] ?? 0);

  return (
    <div className={`${styles.tile} ${styles.static}`}>
      <span className={styles.tileLabel}>
        <span className={styles.swatch} style={{ background: color }} /> {label} open
      </span>
      <span className={styles.tileNumber}>{end.toLocaleString()}</span>
      <span className={styles.tileSub}>
        {delta === 0
          ? "no net change over window"
          : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toLocaleString()} over window`}
      </span>
    </div>
  );
};
