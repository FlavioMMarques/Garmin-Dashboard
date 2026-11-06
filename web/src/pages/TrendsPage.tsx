import { useState } from "react";
import { useDailyRange, type DayPoint } from "../api/daily";
import { useSleep, type Night } from "../api/sleep";
import { TrendChart } from "../components/charts/TrendChart";
import { ErrorBanner } from "../components/ErrorBanner";
import { InsightsPanel } from "../components/InsightsPanel";
import { formatTotalTime } from "../lib/format";
import { localDateKey, shiftDate } from "../lib/health";
import { generateTrendInsights } from "../lib/trendInsights";

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
      <h1>Tendências</h1>

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
  return (
    <>
      <h2 className="section-title">O que as suas tendências mostram</h2>
      <InsightsPanel
        insights={generateTrendInsights({ days, nights })}
        emptyMessage="Ainda não há dados suficientes neste período para observações de tendência (a maioria precisa de pelo menos 3 semanas)."
      />
      <div className="chart-grid">
        <TrendChart
          title="Passos por dia"
          kind="bar"
          dates={days.map((d) => d.date)}
          values={days.map((d) => d.steps)}
          format={(v) => int.format(v)}
          tickFormat={thousands}
          refreshing={refreshing}
        />
        <TrendChart
          title="FC em repouso (bpm)"
          kind="dot"
          dates={days.map((d) => d.date)}
          values={days.map((d) => d.restingHr)}
          format={unit("bpm")}
          refreshing={refreshing}
        />
        <TrendChart
          title="Sono por noite"
          kind="bar"
          dates={nights.map((n) => n.date)}
          values={nights.map((n) => (n.sleepSeconds == null ? null : n.sleepSeconds / 3600))}
          format={(h) => formatTotalTime(h * 3600)}
          tickFormat={(h) => `${int.format(h)} h`}
          note="Cada noite aparece na data em que você acordou."
          refreshing={refreshing}
        />
        <TrendChart
          title="VFC noturna (ms)"
          kind="dot"
          dates={nights.map((n) => n.date)}
          values={nights.map((n) => n.hrvLastNight)}
          format={unit("ms")}
          refreshing={refreshing}
        />
        <TrendChart
          title="Estresse médio do dia (0–100)"
          kind="dot"
          dates={days.map((d) => d.date)}
          values={days.map((d) => d.stressAvg)}
          format={(v) => int.format(v)}
          refreshing={refreshing}
        />
        <TrendChart
          title="Body Battery máximo do dia"
          kind="dot"
          dates={days.map((d) => d.date)}
          values={days.map((d) => d.bodyBatteryMax)}
          format={(v) => int.format(v)}
          note="O pico costuma vir logo depois do sono: mostra quanto a noite recarregou."
          refreshing={refreshing}
        />
      </div>
    </>
  );
}
