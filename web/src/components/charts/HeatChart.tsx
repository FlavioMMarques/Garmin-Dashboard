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
import { formatDistance, formatLocalDateTime, formatPace } from "../../lib/format";
import { robustPaceRange } from "../../lib/pace";
import { heatBins } from "../../lib/training";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { ringedDot } from "./marks";
import { useChartTheme } from "./theme";

const HEIGHT = 240;
const AXIS = { tickLine: false, axisLine: false } as const;
const BIN_C = 2;
const paceTick = (sec: number) => formatPace(1000 / sec).replace(" /km", "");
const paceText = (sec: number) => formatPace(1000 / sec);

interface Point {
  id: number;
  startLocal: string;
  distanceM: number;
  tempC: number;
  secPerKm: number;
}

export function HeatChart({ runs, refreshing }: { runs: RunSummary[]; refreshing?: boolean }) {
  const theme = useChartTheme();
  const points: Point[] = runs.flatMap((r) =>
    r.tempC != null && r.avgSpeedMps && r.distanceM
      ? [
          {
            id: r.id,
            startLocal: r.startLocal,
            distanceM: r.distanceM,
            tempC: r.tempC,
            secPerKm: 1000 / r.avgSpeedMps,
          },
        ]
      : [],
  );
  // Each band's median sits at the middle of the band on the temperature axis.
  const bins = heatBins(runs, BIN_C).map((b) => ({ ...b, tempC: b.fromC + BIN_C / 2 }));
  const { domain, outside } = robustPaceRange(
    points.map((p) => p.secPerKm),
    bins.map((b) => b.medianSecPerKm),
  );
  const coolest = bins[0];
  const hottest = bins.at(-1);
  const compare =
    coolest && hottest && coolest !== hottest
      ? `Mediana a ${coolest.fromC}–${coolest.toC} °C: ${paceText(coolest.medianSecPerKm)} · a ${hottest.fromC}–${hottest.toC} °C: ${paceText(hottest.medianSecPerKm)}`
      : "Pouca variação de temperatura neste período para comparar.";
  const outsideText = outside ? ` · ${outside} fora da escala (ver tabela)` : "";

  return (
    <ChartCard
      title="Ritmo × temperatura (min/km)"
      subtitle={`${compare}${outsideText}`}
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={[
            { label: "Corrida", color: theme.series1, shape: "dot" },
            { label: `Mediana por faixa de ${BIN_C} °C`, color: theme.series1, shape: "line" },
          ]}
        />
      }
      table={{
        columns: ["Faixa", "Corridas", "Ritmo mediano"],
        rows: bins.map((b) => [`${b.fromC}–${b.toC} °C`, b.count, paceText(b.medianSecPerKm)]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="tempC"
            type="number"
            domain={[(min: number) => Math.floor(min) - 1, (max: number) => Math.ceil(max) + 1]}
            tickFormatter={(v: number) => `${v} °C`}
            stroke={theme.text}
            allowDecimals={false}
            {...AXIS}
          />
          <YAxis
            dataKey="secPerKm"
            type="number"
            reversed
            interval={0}
            domain={domain}
            allowDataOverflow
            tickFormatter={paceTick}
            stroke={theme.text}
            width={48}
            {...AXIS}
          />
          <Tooltip
            cursor={{ stroke: theme.axis }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (Point & { medianSecPerKm?: number }) | undefined;
              if (!active || !p || p.medianSecPerKm !== undefined) return null;
              return (
                <TooltipBox
                  title={`${formatLocalDateTime(p.startLocal)} · ${formatDistance(p.distanceM)}`}
                  rows={[
                    {
                      value: paceText(p.secPerKm),
                      label: `a ${Math.round(p.tempC)} °C`,
                      color: theme.series1,
                    },
                  ]}
                />
              );
            }}
          />
          <Scatter
            data={points}
            dataKey="secPerKm"
            isAnimationActive={false}
            shape={ringedDot(theme.series1, theme.surface)}
          />
          <Line
            data={bins}
            dataKey="medianSecPerKm"
            type="linear"
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
