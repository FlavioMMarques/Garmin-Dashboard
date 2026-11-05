import type { ReactNode } from "react";

export interface TableView {
  columns: string[];
  rows: (string | number)[][];
}

interface Props {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  /** Same data as the chart, as a table — tooltips never gate a value. */
  table: TableView;
  /** Hold the previous render, dimmed, while new data loads. */
  refreshing?: boolean;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, legend, table, refreshing, children }: Props) {
  return (
    <figure className={`chart-card${refreshing ? " is-refreshing" : ""}`} aria-busy={refreshing}>
      <h3>{title}</h3>
      {subtitle && <p className="chart-subtitle">{subtitle}</p>}
      {legend}
      {children}
      <details className="chart-table">
        <summary>Ver dados em tabela</summary>
        <div className="chart-table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={i > 0 ? "num" : undefined}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, i) => (
                    <td key={i} className={i > 0 ? "num" : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  /** Mirrors the mark: line for lines, dot for dots, square for bars. */
  shape: "line" | "dot" | "square";
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="chart-legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className={`key-${it.shape}`} style={{ background: it.color }} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export interface TooltipRow {
  value: string;
  label: string;
  color?: string;
}

/** Values lead (strong), series names follow; series keyed by a short line. */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="chart-tooltip-row">
          {r.color && <span className="key-line" style={{ background: r.color }} />}
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}
