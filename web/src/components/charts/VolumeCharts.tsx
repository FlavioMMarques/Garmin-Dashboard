import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { percentDelta } from "../../lib/delta";
import { dayOfYearLabel, formatDayMonth, formatKm1, formatMonthShort } from "../../lib/format";
import type { MonthVolume, WeekVolume, YearToDate } from "../../lib/volume";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { useChartTheme } from "./theme";

const HEIGHT = 220;
const AXIS = { tickLine: false, axisLine: false } as const;
const kmTick = (v: number) => `${Math.round(v)}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function WeeklyVolumeChart({
  weeks,
  refreshing,
}: {
  weeks: WeekVolume[];
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const active = weeks.filter((w) => w.runs > 0);
  const avg = active.length ? weeks.reduce((s, w) => s + w.km, 0) / weeks.length : 0;
  return (
    <ChartCard
      title="Distância por semana (km)"
      subtitle={`Média de ${formatKm1(avg)} por semana · semanas de segunda a domingo`}
      refreshing={refreshing}
      table={{
        columns: ["Semana", "Distância", "Corridas", "Maior corrida"],
        rows: weeks.map((w) => [
          formatDayMonth(w.weekStart),
          formatKm1(w.km),
          w.runs,
          w.longestKm ? formatKm1(w.longestKm) : "—",
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <BarChart data={weeks} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="weekStart"
            tickFormatter={formatDayMonth}
            stroke={theme.text}
            minTickGap={24}
            {...AXIS}
          />
          <YAxis tickFormatter={kmTick} stroke={theme.text} width={44} {...AXIS} />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.6 }}
            content={({ active, payload }) => {
              const w = payload?.[0]?.payload as WeekVolume | undefined;
              if (!active || !w) return null;
              return (
                <TooltipBox
                  title={`Semana de ${formatDayMonth(w.weekStart)}`}
                  rows={[
                    { value: formatKm1(w.km), label: plural(w.runs, "corrida", "corridas") },
                    ...(w.runs ? [{ value: formatKm1(w.longestKm), label: "maior corrida" }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="km"
            fill={theme.series1}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MonthlyVolumeChart({
  months,
  refreshing,
}: {
  months: MonthVolume[];
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  return (
    <ChartCard
      title="Distância por mês (km)"
      refreshing={refreshing}
      table={{
        columns: ["Mês", "Distância", "Corridas"],
        rows: months.map((m) => [formatMonthShort(m.month), formatKm1(m.km), m.runs]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <BarChart data={months} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthShort}
            stroke={theme.text}
            minTickGap={12}
            {...AXIS}
          />
          <YAxis tickFormatter={kmTick} stroke={theme.text} width={44} {...AXIS} />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.6 }}
            content={({ active, payload }) => {
              const m = payload?.[0]?.payload as MonthVolume | undefined;
              if (!active || !m) return null;
              return (
                <TooltipBox
                  title={formatMonthShort(m.month)}
                  rows={[{ value: formatKm1(m.km), label: plural(m.runs, "corrida", "corridas") }]}
                />
              );
            }}
          />
          <Bar
            dataKey="km"
            fill={theme.series1}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Day of year of the 1st of each month, for month ticks. */
function monthTicks(year: number): number[] {
  return Array.from(
    { length: 12 },
    (_, m) =>
      Math.round((new Date(year, m, 1).getTime() - new Date(year, 0, 1).getTime()) / 86_400_000) +
      1,
  );
}

/** Day of year of the last day of each month. */
function monthEnds(year: number, daysInYear: number): number[] {
  return monthTicks(year).map((_, i, starts) => (starts[i + 1] ?? daysInYear + 1) - 1);
}

export function YearToDateChart({ ytd, refreshing }: { ytd: YearToDate; refreshing?: boolean }) {
  const theme = useChartTheme();
  const { year } = ytd;
  const delta = ytd.hasPrevious ? percentDelta(ytd.currentKm, ytd.previousSameDateKm) : null;
  const subtitle = ytd.hasPrevious
    ? `${formatKm1(ytd.currentKm)} em ${year} · ${formatKm1(ytd.previousSameDateKm)} até esta data em ${year - 1}${delta ? ` (${delta.text})` : ""}`
    : `${formatKm1(ytd.currentKm)} em ${year} · sem corridas registradas em ${year - 1}`;
  const monthLabel = (day: number) =>
    formatMonthShort(`${year}-${dayOfYearLabel(year, day).slice(3)}`);

  return (
    <ChartCard
      title="Acumulado no ano (km)"
      subtitle={subtitle}
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={[
            { label: String(year), color: theme.series1, shape: "line" },
            ...(ytd.hasPrevious
              ? [{ label: String(year - 1), color: theme.muted, shape: "line" as const }]
              : []),
          ]}
        />
      }
      table={{
        columns: ["Mês", String(year), ...(ytd.hasPrevious ? [String(year - 1)] : [])],
        // One row per month (its last day) keeps the table readable.
        rows: monthEnds(year, ytd.rows.length)
          .map((day) => ytd.rows[day - 1]!)
          .filter((row) => row.current !== null || ytd.hasPrevious)
          .map((row) => [
            monthLabel(row.day),
            row.current === null ? "—" : formatKm1(row.current),
            ...(ytd.hasPrevious ? [formatKm1(row.previous ?? 0)] : []),
          ]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <LineChart data={ytd.rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="day"
            type="number"
            domain={[1, ytd.rows.length]}
            ticks={monthTicks(year)}
            tickFormatter={monthLabel}
            stroke={theme.text}
            minTickGap={8}
            {...AXIS}
          />
          <YAxis tickFormatter={kmTick} stroke={theme.text} width={52} {...AXIS} />
          <Tooltip
            cursor={{ stroke: theme.axis }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as YearToDate["rows"][number] | undefined;
              if (!active || !row) return null;
              return (
                <TooltipBox
                  title={dayOfYearLabel(year, row.day)}
                  rows={[
                    ...(row.current !== null
                      ? [
                          {
                            value: formatKm1(row.current),
                            label: String(year),
                            color: theme.series1,
                          },
                        ]
                      : []),
                    ...(row.previous !== null
                      ? [
                          {
                            value: formatKm1(row.previous),
                            label: String(year - 1),
                            color: theme.muted,
                          },
                        ]
                      : []),
                  ]}
                />
              );
            }}
          />
          {ytd.hasPrevious && (
            <Line
              dataKey="previous"
              stroke={theme.muted}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            dataKey="current"
            stroke={theme.series1}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
