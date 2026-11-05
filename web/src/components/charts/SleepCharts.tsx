import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HealthDay } from "../../api/wellness";
import { formatDayMonth, formatTotalTime } from "../../lib/format";
import { median } from "../../lib/pace";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { ringedDot } from "./marks";
import { useChartTheme } from "./theme";

const HEIGHT = 220;
const AXIS = { tickLine: false, axisLine: false } as const;
const hours = (s: number | null | undefined) => (s ? Math.round((s / 3600) * 100) / 100 : 0);

const STAGES = [
  { key: "deep", label: "Profundo" },
  { key: "light", label: "Leve" },
  { key: "rem", label: "REM" },
  { key: "awake", label: "Acordado" },
] as const;

/** Stacked sleep stages per night. Stages run deep → awake, so they share one ordinal ramp. */
export function SleepStagesChart({
  days,
  refreshing,
}: {
  days: HealthDay[];
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const colors = { deep: theme.zone5, light: theme.zone3, rem: theme.zone1, awake: theme.muted };
  const rows = days
    .filter((d) => d.sleep?.totalS)
    .map((d) => ({
      date: d.date,
      deep: hours(d.sleep!.deepS),
      light: hours(d.sleep!.lightS),
      rem: hours(d.sleep!.remS),
      awake: hours(d.sleep!.awakeS),
      totalS: d.sleep!.totalS!,
    }));

  return (
    <ChartCard
      title="Fases do sono por noite (horas)"
      subtitle="Cada barra é a noite que terminou naquele dia."
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={STAGES.map((s) => ({ label: s.label, color: colors[s.key], shape: "square" }))}
        />
      }
      table={{
        columns: ["Noite", "Total", ...STAGES.map((s) => s.label)],
        rows: days
          .filter((d) => d.sleep?.totalS)
          .map((d) => [
            formatDayMonth(d.date),
            formatTotalTime(d.sleep!.totalS!),
            ...[d.sleep!.deepS, d.sleep!.lightS, d.sleep!.remS, d.sleep!.awakeS].map((s) =>
              formatTotalTime(s ?? 0),
            ),
          ]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayMonth}
            stroke={theme.text}
            minTickGap={24}
            {...AXIS}
          />
          <YAxis stroke={theme.text} width={44} allowDecimals={false} {...AXIS} />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.6 }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !r) return null;
              return (
                <TooltipBox
                  title={`Noite de ${formatDayMonth(r.date)} · ${formatTotalTime(r.totalS)}`}
                  rows={STAGES.map((s) => ({
                    value: formatTotalTime(r[s.key] * 3600),
                    label: s.label,
                    color: colors[s.key],
                  }))}
                />
              );
            }}
          />
          {STAGES.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="sleep"
              fill={colors[s.key]}
              stroke={theme.surface}
              strokeWidth={2}
              maxBarSize={24}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

const WINDOW = 7;

/** Sleep score per night with a 7-night rolling median. */
export function SleepScoreChart({ days, refreshing }: { days: HealthDay[]; refreshing?: boolean }) {
  const theme = useChartTheme();
  const recent: number[] = [];
  const rows = days.flatMap((d) => {
    const score = d.sleep?.score;
    if (score == null) return [];
    recent.push(score);
    if (recent.length > WINDOW) recent.shift();
    return [{ date: d.date, score, rolling: median(recent) }];
  });

  return (
    <ChartCard
      title="Nota do sono (0–100)"
      subtitle={`Pontos: cada noite. Linha: mediana das últimas ${WINDOW} noites.`}
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={[
            { label: "Noite", color: theme.series1, shape: "dot" },
            { label: `Mediana (${WINDOW})`, color: theme.series1, shape: "line" },
          ]}
        />
      }
      table={{
        columns: ["Noite", "Nota", `Mediana (${WINDOW})`],
        rows: rows.map((r) => [formatDayMonth(r.date), r.score, r.rolling]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayMonth}
            stroke={theme.text}
            minTickGap={24}
            {...AXIS}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            stroke={theme.text}
            width={44}
            {...AXIS}
          />
          <Tooltip
            cursor={{ stroke: theme.axis }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !r) return null;
              return (
                <TooltipBox
                  title={`Noite de ${formatDayMonth(r.date)}`}
                  rows={[
                    { value: String(r.score), label: "nota", color: theme.series1 },
                    { value: String(r.rolling), label: `mediana das últimas ${WINDOW}` },
                  ]}
                />
              );
            }}
          />
          <Scatter
            dataKey="score"
            isAnimationActive={false}
            shape={ringedDot(theme.series1, theme.surface)}
          />
          <Line
            dataKey="rolling"
            stroke={theme.series1}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
