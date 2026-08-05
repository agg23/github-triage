import type { ChartSeries } from "./LineChart";
import styles from "./StatsView.module.scss";

interface SeriesTableProps {
  series: ChartSeries[];
  xLabels: string[];
  rowTotal: boolean;
  footer: boolean;
}

export const SeriesTable: React.FC<SeriesTableProps> = ({
  series,
  xLabels,
  rowTotal,
  footer,
}) => (
  <div className={styles.tableWrap}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Period</th>
          {series.map((line) => (
            <th key={line.key}>{line.label}</th>
          ))}
          {rowTotal && <th>Total</th>}
        </tr>
      </thead>
      <tbody>
        {xLabels.map((text, index) => {
          const cells = series.map((line) => line.values[index]);
          const total = cells.reduce((sum, value) => sum + value, 0);

          return (
            <tr key={index}>
              <td>{text}</td>
              {cells.map((value, cellIndex) => (
                <td key={cellIndex}>{value ? value.toLocaleString() : ""}</td>
              ))}
              {rowTotal && <td className={styles.cellTotal}>{total.toLocaleString()}</td>}
            </tr>
          );
        })}
      </tbody>
      {footer && (
        <tfoot>
          <tr>
            <td>Total</td>
            {series.map((line) => (
              <td key={line.key}>
                {line.values.reduce((sum, value) => sum + value, 0).toLocaleString()}
              </td>
            ))}
            {rowTotal && (
              <td className={styles.cellTotal}>
                {series
                  .flatMap((line) => line.values)
                  .reduce((sum, value) => sum + value, 0)
                  .toLocaleString()}
              </td>
            )}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);
