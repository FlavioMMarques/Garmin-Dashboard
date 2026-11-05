import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, TooltipBox } from "./ChartCard";
import { useChartTheme } from "./theme";

interface LabelCount {
  label: string;
  name: string;
  count: number;
}

const ROW_PX = 32;

/** Ranked horizontal bars: compare how often each training type happened. */
export function TrainingTypesChart({
  counts,
  refreshing,
}: {
  counts: LabelCount[];
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const total = counts.reduce((s, c) => s + c.count, 0);
  const share = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <ChartCard
      title="Tipos de treino (nº de corridas)"
      subtitle="Efeito de treino principal de cada corrida, segundo a Garmin."
      refreshing={refreshing}
      table={{
        columns: ["Tipo", "Corridas", "Parcela"],
        rows: counts.map((c) => [c.name, c.count, share(c.count)]),
      }}
    >
      {counts.length === 0 ? (
        <p className="muted">Sem efeito de treino registrado neste período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={counts.length * ROW_PX + 16}>
          <BarChart
            data={counts}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tickLine={false}
              axisLine={false}
              stroke={theme.text}
            />
            <Tooltip
              cursor={{ fill: theme.grid, opacity: 0.6 }}
              content={({ active, payload }) => {
                const c = payload?.[0]?.payload as LabelCount | undefined;
                if (!active || !c) return null;
                return (
                  <TooltipBox
                    title={c.name}
                    rows={[{ value: String(c.count), label: `corridas (${share(c.count)})` }]}
                  />
                );
              }}
            />
            <Bar
              dataKey="count"
              fill={theme.series1}
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            >
              <LabelList dataKey="count" position="right" className="bar-value" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
