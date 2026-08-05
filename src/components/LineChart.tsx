import { useState } from "react";
import styles from "./StatsView.module.scss";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 260;

const PAD_TOP = 10;

const PAD_RIGHT = 62;
const PAD_BOTTOM = 26;
const PAD_LEFT = 34;

const INNER_WIDTH = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM;

const LABEL_GAP = 12;

const BASE_Y = PAD_TOP + INNER_HEIGHT;
const RIGHT_X = PAD_LEFT + INNER_WIDTH;

const TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

const MAX_X_LABELS = 12;
const CROWDED_PERIODS = 14;

const niceAxisMax = (value: number): number => {
  if (value <= 0) {
    return 1;
  }

  const power = Math.pow(10, Math.floor(Math.log10(value)));

  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * power) {
      return step * power;
    }
  }

  return 10 * power;
};

interface EndLabel {
  key: string;
  label: string;
  color: string;
  y: number;
}

interface LegendProps {
  series: ChartSeries[];
}

export const Legend: React.FC<LegendProps> = ({ series }) => (
  <div className={styles.legend} aria-hidden="true">
    {series.map((line) => (
      <span key={line.key} className={styles.legendItem}>
        <span className={styles.swatch} style={{ background: line.color }} />
        {line.label}
      </span>
    ))}
  </div>
);

interface ChartTooltipProps {
  series: ChartSeries[];
  index: number;
  xLabel: string;
  unitNoun: string;
  leftPct: number;
}

const ChartTooltip: React.FC<ChartTooltipProps> = ({
  series,
  index,
  xLabel,
  unitNoun,
  leftPct,
}) => {
  const rows = series.flatMap((line) =>
    line.values[index] > 0
      ? [{ label: line.label, color: line.color, count: line.values[index] }]
      : [],
  );
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className={styles.tip} style={{ left: `${leftPct}%` }}>
      <div className={styles.tipHead}>
        {xLabel} · {total.toLocaleString()} {unitNoun}
      </div>
      {rows.length === 0 ? (
        <div className={styles.tipRow}>nothing</div>
      ) : (
        rows.map((row) => (
          <div key={row.label} className={styles.tipRow}>
            <span className={styles.swatch} style={{ background: row.color }} />
            {row.label}
            <span className={styles.tipCount}>{row.count.toLocaleString()}</span>
          </div>
        ))
      )}
    </div>
  );
};

interface LineChartProps {
  series: ChartSeries[];
  xLabels: string[];
  caption: React.ReactNode;
  ariaLabel: string;
  unitNoun: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  series,
  xLabels,
  caption,
  ariaLabel,
  unitNoun,
}) => {
  const [hover, setHover] = useState<number | undefined>(undefined);

  const count = xLabels.length;
  const maxY = niceAxisMax(Math.max(1, ...series.flatMap((line) => line.values)));
  const xAt = (index: number) =>
    count <= 1 ? PAD_LEFT + INNER_WIDTH / 2 : PAD_LEFT + (INNER_WIDTH * index) / (count - 1);
  const yAt = (value: number) => BASE_Y - (value / maxY) * INNER_HEIGHT;
  const ticks = TICK_FRACTIONS.map((fraction) => Math.round(fraction * maxY));
  const labelEvery = count > CROWDED_PERIODS ? Math.ceil(count / MAX_X_LABELS) : 1;
  const step = count <= 1 ? INNER_WIDTH : INNER_WIDTH / (count - 1);

  const endLabels: EndLabel[] = series
    .map((line) => ({
      key: line.key,
      label: line.label,
      color: line.color,
      y: yAt(line.values[count - 1]),
    }))
    .sort((first, second) => first.y - second.y);

  for (let index = 1; index < endLabels.length; index++) {
    const gap = endLabels[index].y - endLabels[index - 1].y;

    if (gap < LABEL_GAP) {
      endLabels[index].y = endLabels[index - 1].y + LABEL_GAP;
    }
  }

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.caption}>{caption}</figcaption>
      <div className={styles.chartWrap}>
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className={styles.svg}
          role="img"
          aria-label={ariaLabel}
        >
          {ticks.map((tick) => {
            const gridY = yAt(tick);

            return (
              <g key={tick}>
                <line x1={PAD_LEFT} y1={gridY} x2={RIGHT_X} y2={gridY} className={styles.grid} />
                <text x={PAD_LEFT - 6} y={gridY + 3} className={styles.axisTick} textAnchor="end">
                  {tick}
                </text>
              </g>
            );
          })}

          <line x1={PAD_LEFT} y1={BASE_Y} x2={RIGHT_X} y2={BASE_Y} className={styles.axis} />

          {hover !== undefined && (
            <line
              x1={xAt(hover)}
              y1={PAD_TOP}
              x2={xAt(hover)}
              y2={BASE_Y}
              className={styles.crosshair}
            />
          )}

          {series.map((line) => (
            <g key={line.key}>
              <polyline
                className={styles.trend}
                style={{ stroke: line.color }}
                points={line.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ")}
              />
              {line.values.map((value, index) => (
                <circle
                  key={index}
                  cx={xAt(index)}
                  cy={yAt(value)}
                  r={hover === index ? 4 : 2.6}
                  className={styles.dot}
                  style={{ fill: line.color }}
                />
              ))}
            </g>
          ))}

          {endLabels.map((endLabel) => (
            <g key={endLabel.key}>
              <circle cx={RIGHT_X + 9} cy={endLabel.y} r={3} style={{ fill: endLabel.color }} />
              <text x={RIGHT_X + 15} y={endLabel.y + 3} className={styles.endLabel}>
                {endLabel.label}
              </text>
            </g>
          ))}

          {xLabels.map((_, index) => (
            <rect
              key={index}
              x={Math.max(PAD_LEFT, xAt(index) - step / 2)}
              y={PAD_TOP}
              width={step}
              height={INNER_HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover((current) => (current === index ? undefined : current))}
            />
          ))}

          {xLabels.map((text, index) =>
            index % labelEvery === 0 || index === count - 1 ? (
              <text
                key={index}
                x={xAt(index)}
                y={VIEW_HEIGHT - 8}
                className={styles.axisTick}
                textAnchor="middle"
              >
                {text}
              </text>
            ) : null,
          )}
        </svg>

        {hover !== undefined && (
          <ChartTooltip
            series={series}
            index={hover}
            xLabel={xLabels[hover]}
            unitNoun={unitNoun}
            leftPct={Math.max(16, Math.min(84, (xAt(hover) / VIEW_WIDTH) * 100))}
          />
        )}
      </div>
    </figure>
  );
};
