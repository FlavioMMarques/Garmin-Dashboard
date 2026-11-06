import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Night } from "../../api/sleep";
import { formatDayMonth, formatTotalTime } from "../../lib/format";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { useChartTheme } from "./theme";

const HEIGHT = 240;
const AXIS = { tickLine: false, axisLine: false } as const;
// Categorical slots 1–4 in fixed order (validated adjacent for stacks, light and dark).
const PHASES = [
  { key: "deep", label: "Profundo", field: "deepSeconds" },
  { key: "light", label: "Leve", field: "lightSeconds" },
  { key: "rem", label: "REM", field: "remSeconds" },
  { key: "awake", label: "Acordado", field: "awakeSeconds" },
] as const;

const hours = (s: number | null) => (s == null ? 0 : Math.round((s / 3600) * 100) / 100);
const minutesText = (s: number | null) => (s == null ? "—" : formatTotalTime(s));
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Share of asleep time in each phase, over the nights with phases. */
function phaseShares(nights: Night[]) {
  let deep = 0;
  let rem = 0;
  let asleep = 0;
  for (const n of nights) {
    if (n.deepSeconds == null || n.lightSeconds == null || n.remSeconds == null) continue;
    deep += n.deepSeconds;
    rem += n.remSeconds;
    asleep += n.deepSeconds + n.lightSeconds + n.remSeconds;
  }
  return asleep > 0 ? { deep: deep / asleep, rem: rem / asleep } : null;
}

export function SleepPhasesChart({
  nights,
  refreshing,
}: {
  nights: Night[];
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const colors = [theme.series1, theme.series2, theme.series3, theme.series4];
  const withData = nights.filter((n) => n.hasData);
  const rows = nights.map((n) => ({
    night: n,
    date: n.date,
    ...Object.fromEntries(PHASES.map((p) => [p.key, hours(n[p.field])])),
  }));
  const shares = phaseShares(withData);

  return (
    <ChartCard
      title="Fases do sono por noite (horas)"
      subtitle={
        shares
          ? `Profundo ${pct(shares.deep)} e REM ${pct(shares.rem)} do tempo dormindo. Referência comum para adultos: profundo ~13–23%, REM ~20–25%.`
          : "Sem fases registradas neste período."
      }
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={PHASES.map((p, i) => ({ label: p.label, color: colors[i]!, shape: "square" }))}
        />
      }
      table={{
        columns: ["Noite", ...PHASES.map((p) => p.label), "Total dormindo", "Pontuação"],
        rows: withData.map((n) => [
          formatDayMonth(n.date),
          ...PHASES.map((p) => minutesText(n[p.field])),
          minutesText(n.sleepSeconds),
          n.score ?? "—",
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
          <YAxis stroke={theme.text} width={44} allowDecimals={false} unit="h" {...AXIS} />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.6 }}
            content={({ active, payload }) => {
              const n = (payload?.[0]?.payload as (typeof rows)[number] | undefined)?.night;
              if (!active || !n?.hasData) return null;
              return (
                <TooltipBox
                  title={`Noite de ${formatDayMonth(n.date)} · ${minutesText(n.sleepSeconds)}${n.score != null ? ` · pontuação ${n.score}` : ""}`}
                  rows={[...PHASES]
                    .map((p, i) => ({
                      value: minutesText(n[p.field]),
                      label: p.label,
                      color: colors[i],
                    }))
                    .reverse()}
                />
              );
            }}
          />
          {PHASES.map((p, i) => (
            <Bar
              key={p.key}
              dataKey={p.key}
              stackId="phases"
              fill={colors[i]}
              // 2px surface gap between stacked segments
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
