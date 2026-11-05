import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RunSummary } from "../../api/runs";
import { formatDayMonth, formatDecimal, formatLocalDateTime } from "../../lib/format";
import { efficiencyTrend } from "../../lib/performance";
import { metricSeries, robustRange, type MetricPoint } from "../../lib/training";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { ringedDot } from "./marks";
import { useChartTheme } from "./theme";

const HEIGHT = 130;
const AXIS = { tickLine: false, axisLine: false } as const;

interface Metric {
  key: keyof RunSummary;
  label: string;
  unit: string;
  digits: number;
  /** Which direction is generally considered better form; null when it depends. */
  better: "up" | "down" | null;
}

export const DYNAMICS: Metric[] = [
  { key: "cadenceSpm", label: "Cadência", unit: "ppm", digits: 0, better: "up" },
  { key: "groundContactMs", label: "Tempo de contato", unit: "ms", digits: 0, better: "down" },
  { key: "verticalOscCm", label: "Oscilação vertical", unit: "cm", digits: 1, better: "down" },
  { key: "verticalRatio", label: "Razão vertical", unit: "%", digits: 1, better: "down" },
  { key: "strideCm", label: "Passada", unit: "cm", digits: 0, better: null },
  { key: "powerW", label: "Potência", unit: "W", digits: 0, better: null },
];

const BETTER_TEXT = { up: "maior é melhor", down: "menor é melhor" } as const;
const toTime = (startLocal: string) => new Date(startLocal.replace(" ", "T")).getTime();
const timeTick = (t: number) => {
  const d = new Date(t);
  return formatDayMonth(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  );
};

type Row = MetricPoint & { t: number };

/** Small multiples: each metric has its own unit and scale, so each gets its own chart. */
export function DynamicsChart({
  runs,
  window,
  refreshing,
}: {
  runs: RunSummary[];
  window: number;
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const metrics = DYNAMICS.map((m) => {
    const points = metricSeries(runs, (r) => r[m.key] as number | null, window);
    return { ...m, points, rows: points.map((p) => ({ ...p, t: toTime(p.startLocal) })) as Row[] };
  }).filter((m) => m.points.length > 0);
  const fmt = (m: Metric, v: number) => `${formatDecimal(v, m.digits)} ${m.unit}`;
  const byRun = new Map<number, string>(runs.map((r) => [r.id, r.startLocal]));

  return (
    <ChartCard
      title="Dinâmica de corrida"
      subtitle={`Cada ponto é uma corrida; a linha é a mediana das últimas ${window}. Corridas leves e treinos de tiro mudam esses valores — compare tendências, não corridas isoladas.`}
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={[
            { label: "Corrida", color: theme.series1, shape: "dot" },
            { label: `Mediana (${window})`, color: theme.series1, shape: "line" },
          ]}
        />
      }
      table={{
        columns: ["Data", ...metrics.map((m) => `${m.label} (${m.unit})`)],
        rows: [...byRun.entries()].map(([id, startLocal]) => [
          formatLocalDateTime(startLocal),
          ...metrics.map((m) => {
            const p = m.points.find((x) => x.id === id);
            return p ? formatDecimal(p.value, m.digits) : "—";
          }),
        ]),
      }}
    >
      <div className="multiples">
        {metrics.map((m) => {
          const trend = efficiencyTrend(m.points, window);
          const domain = robustRange(
            m.points.map((p) => p.value),
            m.points.map((p) => p.rolling),
          );
          return (
            <div key={m.key} className="multiple">
              <h4>
                {m.label}{" "}
                <span className="muted">
                  {trend && `· ${fmt(m, trend.first)} → ${fmt(m, trend.last)}`}
                  {m.better && ` · ${BETTER_TEXT[m.better]}`}
                </span>
              </h4>
              <ResponsiveContainer width="100%" height={HEIGHT}>
                <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                  <CartesianGrid vertical={false} stroke={theme.grid} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={timeTick}
                    stroke={theme.text}
                    minTickGap={32}
                    {...AXIS}
                  />
                  <YAxis
                    dataKey="value"
                    type="number"
                    domain={domain}
                    allowDataOverflow
                    tickCount={3}
                    tickFormatter={(v: number) => formatDecimal(v, m.digits)}
                    stroke={theme.text}
                    width={44}
                    {...AXIS}
                  />
                  <Tooltip
                    cursor={{ stroke: theme.axis }}
                    content={({ active, payload }) => {
                      const r = payload?.[0]?.payload as Row | undefined;
                      if (!active || !r) return null;
                      return (
                        <TooltipBox
                          title={`${m.label} · ${formatLocalDateTime(r.startLocal)}`}
                          rows={[
                            {
                              value: fmt(m, r.value),
                              label: "nesta corrida",
                              color: theme.series1,
                            },
                            { value: fmt(m, r.rolling), label: `mediana das últimas ${window}` },
                          ]}
                        />
                      );
                    }}
                  />
                  <Scatter
                    data={m.rows}
                    dataKey="value"
                    isAnimationActive={false}
                    shape={ringedDot(theme.series1, theme.surface, 0.45)}
                  />
                  <Line
                    data={m.rows}
                    dataKey="rolling"
                    stroke={theme.series1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
