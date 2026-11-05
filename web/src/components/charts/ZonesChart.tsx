import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayMonth, formatTotalTime } from "../../lib/format";
import type { WeekZones } from "../../lib/training";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { useChartTheme } from "./theme";

const HEIGHT = 220;
const AXIS = { tickLine: false, axisLine: false } as const;
const ZONES = [
  { key: "z1", label: "Z1 Aquecimento" },
  { key: "z2", label: "Z2 Leve" },
  { key: "z3", label: "Z3 Aeróbica" },
  { key: "z4", label: "Z4 Limiar" },
  { key: "z5", label: "Z5 Máximo" },
] as const;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const minutes = (s: number) => Math.round(s / 60);

interface Share {
  easy: number;
  moderate: number;
  hard: number;
}

export function ZonesChart({
  weeks,
  share,
  refreshing,
}: {
  weeks: WeekZones[];
  share: Share | null;
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const colors = [theme.zone1, theme.zone2, theme.zone3, theme.zone4, theme.zone5];
  const rows = weeks.map((w) => ({
    weekStart: w.weekStart,
    totalS: w.totalS,
    ...Object.fromEntries(ZONES.map((z, i) => [z.key, minutes(w.zones[i]!)])),
  })) as ({ weekStart: string; totalS: number } & Record<(typeof ZONES)[number]["key"], number>)[];

  return (
    <ChartCard
      title="Tempo por zona de FC por semana (min)"
      subtitle={
        share
          ? `Leve (Z1–Z2) ${pct(share.easy)} · Moderado (Z3) ${pct(share.moderate)} · Forte (Z4–Z5) ${pct(share.hard)} do tempo com FC. Referência comum para quem treina por volume: ~80% leve.`
          : "Sem dados de zona de FC neste período."
      }
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={ZONES.map((z, i) => ({ label: z.label, color: colors[i]!, shape: "square" }))}
        />
      }
      table={{
        columns: ["Semana", ...ZONES.map((z) => z.label), "Total"],
        rows: weeks.map((w) => [
          formatDayMonth(w.weekStart),
          ...w.zones.map((s) => `${minutes(s)} min`),
          formatTotalTime(w.totalS),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="weekStart"
            tickFormatter={formatDayMonth}
            stroke={theme.axis}
            minTickGap={24}
            {...AXIS}
          />
          <YAxis stroke={theme.axis} width={44} allowDecimals={false} {...AXIS} />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.6 }}
            content={({ active, payload }) => {
              const w = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !w) return null;
              return (
                <TooltipBox
                  title={`Semana de ${formatDayMonth(w.weekStart)} · ${formatTotalTime(w.totalS)}`}
                  rows={[...ZONES]
                    .map((z, i) => ({ value: `${w[z.key]} min`, label: z.label, color: colors[i] }))
                    .reverse()}
                />
              );
            }}
          />
          {ZONES.map((z, i) => (
            <Bar
              key={z.key}
              dataKey={z.key}
              stackId="zones"
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
