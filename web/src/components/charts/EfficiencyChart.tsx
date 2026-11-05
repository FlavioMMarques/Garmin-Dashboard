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
import { percentDelta } from "../../lib/delta";
import {
  formatDayMonth,
  formatDecimal,
  formatDistance,
  formatLocalDateTime,
  formatPace,
} from "../../lib/format";
import { efficiencyTrend, type EfficiencyPoint } from "../../lib/performance";
import { ChartCard, TooltipBox } from "./ChartCard";
import { ringedDot } from "./marks";
import { useChartTheme } from "./theme";

const HEIGHT = 240;
const AXIS = { tickLine: false, axisLine: false } as const;
const toTime = (startLocal: string) => new Date(startLocal.replace(" ", "T")).getTime();
const timeTick = (t: number) => {
  const d = new Date(t);
  return formatDayMonth(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  );
};

type Row = EfficiencyPoint & { t: number };

export function EfficiencyChart({
  points,
  window,
  refreshing,
}: {
  points: EfficiencyPoint[];
  window: number;
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const rows: Row[] = points.map((p) => ({ ...p, t: toTime(p.startLocal) }));
  const { first, last } = efficiencyTrend(points, window) ?? {};
  const delta = first && last ? percentDelta(last, first) : null;
  const trend =
    first && last
      ? `Tendência (mediana das últimas ${window}): ${formatDecimal(first)} → ${formatDecimal(last)} m${delta ? ` (${delta.text})` : ""}`
      : "";

  return (
    <ChartCard
      title="Eficiência aeróbica (metros por batimento)"
      subtitle={
        <>
          Quanto você avança a cada batimento do coração. Subir = mais rápido com o mesmo esforço.
          {trend && (
            <>
              <br />
              {trend}
            </>
          )}
        </>
      }
      refreshing={refreshing}
      table={{
        columns: ["Data", "Distância", "Ritmo", "FC média", "m/batimento", `Mediana (${window})`],
        rows: rows.map((r) => [
          formatLocalDateTime(r.startLocal),
          formatDistance(r.distanceM),
          formatPace(r.avgSpeedMps),
          `${Math.round(r.avgHr)} bpm`,
          formatDecimal(r.metersPerBeat),
          formatDecimal(r.rolling),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={timeTick}
            stroke={theme.axis}
            minTickGap={32}
            {...AXIS}
          />
          <YAxis
            dataKey="metersPerBeat"
            type="number"
            domain={[
              (min: number) => Math.floor(min * 20) / 20,
              (max: number) => Math.ceil(max * 20) / 20,
            ]}
            tickFormatter={(v: number) => formatDecimal(v)}
            stroke={theme.axis}
            width={48}
            {...AXIS}
          />
          <Tooltip
            cursor={{ stroke: theme.axis }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as Row | undefined;
              if (!active || !r) return null;
              return (
                <TooltipBox
                  title={`${formatLocalDateTime(r.startLocal)} · ${formatDistance(r.distanceM)}`}
                  rows={[
                    {
                      value: `${formatDecimal(r.metersPerBeat)} m`,
                      label: `${formatPace(r.avgSpeedMps)} a ${Math.round(r.avgHr)} bpm`,
                      color: theme.series1,
                    },
                    {
                      value: `${formatDecimal(r.rolling)} m`,
                      label: `mediana das últimas ${window}`,
                    },
                  ]}
                />
              );
            }}
          />
          <Scatter
            data={rows}
            dataKey="metersPerBeat"
            isAnimationActive={false}
            shape={ringedDot(theme.series1, theme.surface)}
          />
          <Line
            data={rows}
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
