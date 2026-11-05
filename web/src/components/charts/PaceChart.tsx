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
import { formatDayMonth, formatDistance, formatLocalDateTime, formatPace } from "../../lib/format";
import {
  BUCKETS,
  paceDomain,
  paceTrend,
  type DistanceBucket,
  type PacePoint,
} from "../../lib/pace";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { ringedDot } from "./marks";
import { useChartTheme, type ChartTheme } from "./theme";

const HEIGHT = 260;
const AXIS = { tickLine: false, axisLine: false } as const;

/** Seconds per km → "5:46" (axis) — no unit, the title carries it. */
const paceTick = (sec: number) => formatPace(1000 / sec).replace(" /km", "");
const paceText = (sec: number) => formatPace(1000 / sec);
const toTime = (startLocal: string) => new Date(startLocal.replace(" ", "T")).getTime();
const timeTick = (t: number) => {
  const d = new Date(t);
  return formatDayMonth(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  );
};

/** Color follows the bucket, never its position in the visible set. */
function bucketColor(theme: ChartTheme, bucket: DistanceBucket): string {
  return { short: theme.series1, medium: theme.series2, long: theme.series3 }[bucket];
}

const bucketLabel = (b: DistanceBucket) => BUCKETS.find((x) => x.id === b)!.label;

type Row = PacePoint & { t: number };

export function PaceChart({
  points,
  window,
  refreshing,
}: {
  points: PacePoint[];
  window: number;
  refreshing?: boolean;
}) {
  const theme = useChartTheme();
  const trends = paceTrend(points, window);
  const rows: Row[] = points.map((p) => ({ ...p, t: toTime(p.startLocal) }));
  const byBucket = trends.map((tr) => ({
    ...tr,
    color: bucketColor(theme, tr.bucket),
    rows: rows.filter((r) => r.bucket === tr.bucket),
  }));

  const { domain, outside } = paceDomain(points);
  const trendText = trends
    .map(
      (tr) =>
        `${bucketLabel(tr.bucket)} ${paceTick(tr.firstSecPerKm)} → ${paceTick(tr.lastSecPerKm)}`,
    )
    .join(" · ");
  const outsideText = outside
    ? ` · ${outside} ${outside === 1 ? "corrida fora" : "corridas fora"} da escala (ver tabela)`
    : "";

  return (
    <ChartCard
      title="Ritmo por corrida (min/km)"
      subtitle={`Tendência (mediana das últimas ${window} por faixa): ${trendText}${outsideText}`}
      refreshing={refreshing}
      legend={
        <ChartLegend
          items={byBucket.map((b) => ({
            label: bucketLabel(b.bucket),
            color: b.color,
            shape: "dot",
          }))}
        />
      }
      table={{
        columns: ["Data", "Distância", "Ritmo", `Mediana (${window})`],
        rows: rows.map((r) => [
          formatLocalDateTime(r.startLocal),
          formatDistance(r.distanceM),
          paceText(r.secPerKm),
          paceText(r.rollingSecPerKm),
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
            dataKey="secPerKm"
            type="number"
            reversed
            domain={domain}
            allowDataOverflow
            tickFormatter={paceTick}
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
                      value: paceText(r.secPerKm),
                      label: "nesta corrida",
                      color: bucketColor(theme, r.bucket),
                    },
                    { value: paceText(r.rollingSecPerKm), label: `mediana das últimas ${window}` },
                  ]}
                />
              );
            }}
          />
          {byBucket.map((b) => (
            <Scatter
              key={`dots-${b.bucket}`}
              name={bucketLabel(b.bucket)}
              data={b.rows}
              dataKey="secPerKm"
              isAnimationActive={false}
              shape={ringedDot(b.color, theme.surface)}
            />
          ))}
          {byBucket.map((b) => (
            <Line
              key={`trend-${b.bucket}`}
              data={b.rows}
              dataKey="rollingSecPerKm"
              stroke={b.color}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
