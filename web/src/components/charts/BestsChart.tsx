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
import type { BestDistance } from "../../api/runs";
import { formatDuration, formatMonthShort } from "../../lib/format";
import { BEST_DISTANCES, type MonthBest } from "../../lib/performance";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { ringedDot } from "./marks";
import { useChartTheme } from "./theme";

const HEIGHT = 150;
const AXIS = { tickLine: false, axisLine: false } as const;

export interface DistanceBests {
  distance: BestDistance;
  months: MonthBest[];
}

/**
 * Small multiples, one per distance: times differ by an order of magnitude
 * between 1 km and 21 km, so they never share an axis.
 */
export function BestsChart({
  series,
  refreshing,
}: {
  series: DistanceBests[];
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const label = (d: BestDistance) => BEST_DISTANCES.find((x) => x.id === d)!.label;
  const shown = series.filter((s) => s.months.length > 0);
  const allMonths = [...new Set(shown.flatMap((s) => s.months.map((m) => m.month)))].sort();

  return (
    <ChartCard
      title="Evolução das melhores marcas"
      subtitle="Melhor tempo de cada mês (pontos) e recorde até então (linha). Mais rápido fica em cima."
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={[
            { label: "Melhor do mês", color: theme.series1, shape: "dot" },
            { label: "Recorde até então", color: theme.series1, shape: "line" },
          ]}
        />
      }
      table={{
        columns: ["Mês", ...shown.map((s) => label(s.distance))],
        rows: allMonths.map((month) => [
          formatMonthShort(month),
          ...shown.map((s) => {
            const m = s.months.find((x) => x.month === month);
            return m ? formatDuration(m.best) : "—";
          }),
        ]),
      }}
    >
      <div className="multiples">
        {shown.map((s) => (
          <div key={s.distance} className="multiple">
            <h4>
              {label(s.distance)}{" "}
              <span className="muted">· recorde {formatDuration(s.months.at(-1)!.record)}</span>
            </h4>
            <ResponsiveContainer width="100%" height={HEIGHT}>
              <ComposedChart data={s.months} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                <CartesianGrid vertical={false} stroke={theme.grid} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthShort}
                  stroke={theme.text}
                  minTickGap={8}
                  {...AXIS}
                />
                <YAxis
                  reversed
                  interval={0}
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) => formatDuration(v)}
                  stroke={theme.text}
                  width={56}
                  tickCount={3}
                  {...AXIS}
                />
                <Tooltip
                  cursor={{ stroke: theme.axis }}
                  content={({ active, payload }) => {
                    const m = payload?.[0]?.payload as MonthBest | undefined;
                    if (!active || !m) return null;
                    return (
                      <TooltipBox
                        title={`${label(s.distance)} · ${formatMonthShort(m.month)}`}
                        rows={[
                          {
                            value: formatDuration(m.best),
                            label: "melhor do mês",
                            color: theme.series1,
                          },
                          { value: formatDuration(m.record), label: "recorde até então" },
                        ]}
                      />
                    );
                  }}
                />
                <Line
                  dataKey="record"
                  type="stepAfter"
                  stroke={theme.series1}
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Scatter
                  dataKey="best"
                  isAnimationActive={false}
                  shape={ringedDot(theme.series1, theme.surface, 0.6)}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
