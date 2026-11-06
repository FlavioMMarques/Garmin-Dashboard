import { useState } from "react";
import { useDailyRange, type DayPoint } from "../api/daily";
import { useSleep, type Night } from "../api/sleep";
import { TrendChart } from "../components/charts/TrendChart";
import { ErrorBanner } from "../components/ErrorBanner";
import { InsightsPanel } from "../components/InsightsPanel";
import { formatTotalTime } from "../lib/format";
import { localDateKey, shiftDate } from "../lib/health";
import { generateTrendInsights } from "../lib/trendInsights";
import { seriesSummary } from "../lib/trends";
import { StatTile } from "../components/StatTile";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "1 ano" },
] as const;
type Days = (typeof PERIODS)[number]["days"];

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const unit = (u: string) => (v: number) => `${int.format(v)} ${u}`;
/** Axis labels: 12000 → "12 mil", 5500 → "5,5 mil". */
const oneDecimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const thousands = (v: number) => (v >= 1000 ? `${oneDecimal.format(v / 1000)} mil` : int.format(v));

/** Last 7 days against the whole period: ±3% counts as stable. */
function direction(values: (number | null)[]): string | undefined {
  const s = seriesSummary(values);
  if (s.mean == null || s.last7 == null || s.mean === 0) return undefined;
  const change = (s.last7 - s.mean) / s.mean;
  if (change > 0.03) return "▲ subindo nos últimos 7 dias";
  if (change < -0.03) return "▼ caindo nos últimos 7 dias";
  return "■ estável nos últimos 7 dias";
}

/** The most recent non-null value of a field. */
function latest<T>(items: T[], pick: (t: T) => number | null): number | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const v = pick(items[i]!);
    if (v != null) return v;
  }
  return null;
}

export function TrendsPage() {
  const today = localDateKey(new Date());
  const [period, setPeriod] = useState<Days>(30);
  const from = shiftDate(today, -(period - 1));
  const daily = useDailyRange(from, today);
  const sleep = useSleep(from, today);
  const error = daily.error ?? sleep.error;
  const refreshing = daily.isPlaceholderData || sleep.isPlaceholderData;
  const fetching = daily.isFetching || sleep.isFetching;

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Tendências</h1>
          <p className="page-subtitle">
            Como as métricas de saúde evoluem · pontos = cada dia, linha = média de 7 dias
          </p>
        </div>
        <div className="toolbar" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              aria-pressed={p.days === period}
              onClick={() => setPeriod(p.days)}
            >
              {p.label}
            </button>
          ))}
          {fetching && !(daily.isPending || sleep.isPending) && (
            <span className="muted">carregando…</span>
          )}
        </div>
      </div>

      {error ? (
        <ErrorBanner
          error={error}
          onRetry={() => {
            void daily.refetch();
            void sleep.refetch();
          }}
        />
      ) : !daily.data || !sleep.data ? (
        <div className="chart-grid" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="chart-card skeleton" style={{ height: "16rem" }} />
          ))}
        </div>
      ) : (
        <TrendCharts
          days={daily.data}
          nights={sleep.data}
          period={period}
          refreshing={refreshing}
        />
      )}
    </section>
  );
}

function TrendCharts({
  days,
  nights,
  period,
  refreshing,
}: {
  days: DayPoint[];
  nights: Night[];
  period: Days;
  refreshing: boolean;
}) {
  if (!days.some((d) => d.hasData) && !nights.some((n) => n.hasData)) {
    return (
      <p role="status" className="panel muted">
        Nenhum dado do relógio nos últimos {period} dias.
      </p>
    );
  }
  const dates = days.map((d) => d.date);
  const nightDates = nights.map((n) => n.date);
  const steps = days.map((d) => d.steps);
  const restingHr = days.map((d) => d.restingHr);
  const sleepHours = nights.map((n) => (n.sleepSeconds == null ? null : n.sleepSeconds / 3600));
  const hrv = nights.map((n) => n.hrvLastNight);
  const stress = days.map((d) => d.stressAvg);
  const bodyBattery = days.map((d) => d.bodyBatteryMax);

  const stepGoal = latest(days, (d) => d.stepGoal);
  const sleepNeed = seriesSummary(nights.map((n) => n.sleepNeedMinutes)).mean;
  const hrvLow = latest(nights, (n) => n.hrvBalancedLow);
  const hrvHigh = latest(nights, (n) => n.hrvBalancedUpper);
  const goalDays = days.filter(
    (d) => d.steps != null && d.stepGoal != null && d.steps >= d.stepGoal,
  ).length;

  const mean = (values: (number | null)[], fmt: (v: number) => string) => {
    const m = seriesSummary(values).mean;
    return m == null ? "—" : fmt(m);
  };

  return (
    <>
      <div
        className={`stat-grid score-grid${refreshing ? " is-refreshing" : ""}`}
        role="group"
        aria-label="Médias do período"
      >
        <StatTile
          label="Passos por dia"
          value={mean(steps, (v) => int.format(v))}
          detail={stepGoal != null ? `meta batida em ${goalDays} dias` : direction(steps)}
        />
        <StatTile
          label="FC em repouso"
          value={mean(restingHr, unit("bpm"))}
          detail={direction(restingHr)}
        />
        <StatTile
          label="Sono por noite"
          value={mean(sleepHours, (h) => formatTotalTime(h * 3600))}
          detail={direction(sleepHours)}
        />
        <StatTile label="VFC noturna" value={mean(hrv, unit("ms"))} detail={direction(hrv)} />
        <StatTile
          label="Estresse médio"
          value={mean(stress, (v) => int.format(v))}
          detail={direction(stress)}
        />
        <StatTile
          label="Body Battery máx."
          value={mean(bodyBattery, (v) => int.format(v))}
          detail={direction(bodyBattery)}
        />
      </div>

      <h2 className="section-title">O que as suas tendências mostram</h2>
      <InsightsPanel
        insights={generateTrendInsights({ days, nights })}
        emptyMessage="Ainda não há dados suficientes neste período para observações de tendência (a maioria precisa de pelo menos 3 semanas)."
      />

      <h2 className="section-title">Recuperação</h2>
      <div className="chart-grid">
        <TrendChart
          title="FC em repouso (bpm)"
          kind="dot"
          dates={dates}
          values={restingHr}
          format={unit("bpm")}
          color="series2"
          refreshing={refreshing}
        />
        <TrendChart
          title="VFC noturna (ms)"
          kind="dot"
          dates={nightDates}
          values={hrv}
          format={unit("ms")}
          band={
            hrvLow != null && hrvHigh != null
              ? { low: hrvLow, high: hrvHigh, label: `faixa equilibrada ${hrvLow}–${hrvHigh} ms` }
              : undefined
          }
          refreshing={refreshing}
        />
        <TrendChart
          title="Sono por noite"
          kind="bar"
          dates={nightDates}
          values={sleepHours}
          format={(h) => formatTotalTime(h * 3600)}
          tickFormat={(h) => `${int.format(h)} h`}
          note="Cada noite aparece na data em que você acordou."
          reference={
            sleepNeed != null
              ? {
                  value: sleepNeed / 60,
                  label: `necessidade média ${formatTotalTime(sleepNeed * 60)}`,
                }
              : undefined
          }
          refreshing={refreshing}
        />
        <TrendChart
          title="Body Battery máximo do dia"
          kind="dot"
          dates={dates}
          values={bodyBattery}
          format={(v) => int.format(v)}
          note="O pico costuma vir logo depois do sono: mostra quanto a noite recarregou."
          color="series3"
          refreshing={refreshing}
        />
      </div>

      <h2 className="section-title">Atividade e estresse</h2>
      <div className="chart-grid">
        <TrendChart
          title="Passos por dia"
          kind="bar"
          dates={dates}
          values={steps}
          format={(v) => int.format(v)}
          tickFormat={thousands}
          reference={
            stepGoal != null ? { value: stepGoal, label: `meta ${int.format(stepGoal)}` } : undefined
          }
          refreshing={refreshing}
        />
        <TrendChart
          title="Estresse médio do dia (0–100)"
          kind="dot"
          dates={dates}
          values={stress}
          format={(v) => int.format(v)}
          color="series4"
          refreshing={refreshing}
        />
      </div>
    </>
  );
}
