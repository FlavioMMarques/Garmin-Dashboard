import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayMonth } from "../../lib/format";
import { rollingMean, seriesSummary } from "../../lib/trends";
import { ChartCard, ChartLegend, TooltipBox } from "./ChartCard";
import { useChartTheme, type ChartTheme } from "./theme";

const HEIGHT = 200;
const AXIS = { tickLine: false, axisLine: false } as const;

interface Props {
  title: string;
  /** One value per date; null = no data that day. */
  dates: string[];
  values: (number | null)[];
  format: (v: number) => string;
  /** Short axis labels (the title carries the unit); plain integers by default. */
  tickFormat?: (v: number) => string;
  /** Bars start at zero (counts, durations); dots let the axis fit the data (HR, HRV…). */
  kind: "bar" | "dot";
  note?: string;
  refreshing?: boolean;
  /** Series color for the 7-day mean; series1 by default. */
  color?: keyof ChartTheme;
  /** A dashed reference line, e.g. the step goal. */
  reference?: { value: number; label: string };
  /** A shaded band, e.g. the balanced HRV range. */
  band?: { low: number; high: number; label: string };
}

/** Daily value (neutral) plus its 7-day mean (series color), on one axis. */
const plainInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function TrendChart({
  title,
  dates,
  values,
  format,
  tickFormat = (v) => plainInt.format(v),
  kind,
  note,
  refreshing,
  color = "series1",
  reference,
  band,
}: Props) {
  const theme = useChartTheme();
  const stroke = theme[color];
  const avg = rollingMean(values);
  const rows = dates.map((date, i) => ({ date, value: values[i] ?? null, avg: avg[i] ?? null }));
  const s = seriesSummary(values);
  const summary = [
    s.mean != null && `Média do período ${format(s.mean)}`,
    s.last7 != null && `últimos 7 dias ${format(s.last7)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ChartCard
      title={title}
      subtitle={
        <>
          {summary || "Sem dados neste período."}
          {note && (
            <>
              <br />
              {note}
            </>
          )}
        </>
      }
      refreshing={refreshing}
      aside={
        s.last7 != null && (
          <>
            <strong>{format(s.last7)}</strong>
            <span>média dos últimos 7 dias</span>
          </>
        )
      }
      legend={
        <ChartLegend
          items={[
            { label: "Dia", color: theme.muted, shape: kind === "bar" ? "square" : "dot" },
            { label: "Média de 7 dias", color: stroke, shape: "line" },
            ...(band ? [{ label: band.label, color: theme.grid, shape: "square" as const }] : []),
            ...(reference
              ? [{ label: reference.label, color: theme.text, shape: "line" as const }]
              : []),
          ]}
        />
      }
      table={{
        columns: ["Data", "Valor", "Média de 7 dias"],
        rows: rows
          .filter((r) => r.value != null)
          .map((r) => [
            formatDayMonth(r.date),
            format(r.value!),
            r.avg == null ? "—" : format(r.avg),
          ]),
      }}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          {band && (
            <ReferenceArea
              y1={band.low}
              y2={band.high}
              fill={theme.grid}
              fillOpacity={0.7}
              ifOverflow="extendDomain"
            />
          )}
          <XAxis
            dataKey="date"
            tickFormatter={formatDayMonth}
            stroke={theme.text}
            minTickGap={28}
            {...AXIS}
          />
          <YAxis
            stroke={theme.text}
            width={64}
            domain={kind === "bar" ? [0, "auto"] : ["auto", "auto"]}
            tickFormatter={tickFormat}
            allowDecimals={false}
            {...AXIS}
          />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.6 }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !r) return null;
              return (
                <TooltipBox
                  title={formatDayMonth(r.date)}
                  rows={[
                    {
                      value: r.value == null ? "—" : format(r.value),
                      label: "dia",
                      color: theme.muted,
                    },
                    {
                      value: r.avg == null ? "—" : format(r.avg),
                      label: "média de 7 dias",
                      color: stroke,
                    },
                  ]}
                />
              );
            }}
          />
          {kind === "bar" ? (
            <Bar dataKey="value" fill={theme.muted} maxBarSize={12} isAnimationActive={false} />
          ) : (
            <Line
              dataKey="value"
              stroke="none"
              dot={{ r: 3, fill: theme.muted, stroke: theme.surface, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          )}
          {reference && (
            <ReferenceLine
              y={reference.value}
              stroke={theme.text}
              strokeDasharray="5 4"
              ifOverflow="extendDomain"
            />
          )}
          <Line
            dataKey="avg"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
