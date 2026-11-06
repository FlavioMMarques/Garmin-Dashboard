import { useState } from "react";
import { useSleep } from "../api/sleep";
import { SleepPhasesChart } from "../components/charts/SleepPhasesChart";
import { ErrorBanner } from "../components/ErrorBanner";
import { InsightsPanel } from "../components/InsightsPanel";
import { StatTile } from "../components/StatTile";
import { PhaseBar } from "../components/health/PhaseBar";
import { formatTotalTime } from "../lib/format";
import { localDateKey, shiftDate } from "../lib/health";
import { formatClock, summarizeNights } from "../lib/sleep";
import { generateSleepInsights } from "../lib/sleepInsights";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];
const DASH = "—";
const nightDay = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function SleepPage() {
  const today = localDateKey(new Date());
  const [period, setPeriod] = useState<Period>(30);
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useSleep(
    shiftDate(today, -(period - 1)),
    today,
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Sono</h1>
          <p className="page-subtitle">
            Últimas {period} noites · cada noite aparece na data em que você acordou
          </p>
        </div>
        <div className="toolbar" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p} type="button" aria-pressed={p === period} onClick={() => setPeriod(p)}>
              {p} noites
            </button>
          ))}
          {isFetching && !isPending && <span className="muted">carregando…</span>}
        </div>
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="stat-grid" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="stat-tile skeleton" style={{ height: "5.5rem" }} />
          ))}
        </div>
      ) : (
        <SleepContent nights={data} period={period} refreshing={isPlaceholderData} />
      )}
    </section>
  );
}

function SleepContent({
  nights,
  period,
  refreshing,
}: {
  nights: NonNullable<ReturnType<typeof useSleep>["data"]>;
  period: Period;
  refreshing: boolean;
}) {
  const s = summarizeNights(nights);
  if (s.nights === 0) {
    return (
      <p role="status" className="panel muted">
        Nenhuma noite registrada nos últimos {period} dias.
      </p>
    );
  }
  const hrvRange = nights.at(-1);
  const last = nights.filter((n) => n.hasData).at(-1)!;
  const lastWindow =
    last.startLocal && last.endLocal
      ? `${formatClock(Number(last.startLocal.slice(11, 13)) * 60 + Number(last.startLocal.slice(14, 16)))} → ${formatClock(Number(last.endLocal.slice(11, 13)) * 60 + Number(last.endLocal.slice(14, 16)))}`
      : null;
  return (
    <>
      <div
        className={`kpi-row${refreshing ? " is-refreshing" : ""}`}
        role="group"
        aria-label="Resumo do sono no período"
      >
        <StatTile
          variant="hero"
          label={`Última noite · acordou ${nightDay.format(new Date(`${last.date}T12:00:00Z`)).replace(/\./g, "")}`}
          value={last.sleepSeconds == null ? DASH : formatTotalTime(last.sleepSeconds)}
          detail={[
            lastWindow,
            last.score != null && `pontuação ${last.score}`,
            last.hrvLastNight != null && `VFC ${last.hrvLastNight} ms`,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <PhaseBar night={last} />
        </StatTile>
        <div className="kpi-grid">
          <StatTile
            label="Sono médio"
            value={s.avgSleepSeconds == null ? DASH : formatTotalTime(s.avgSleepSeconds)}
            detail={[
              `${s.nights} de ${period} noites registradas`,
              s.avgNeedMinutes != null &&
                `necessidade média ${formatTotalTime(s.avgNeedMinutes * 60)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <StatTile
            label="Pontuação média"
            value={s.avgScore == null ? DASH : String(Math.round(s.avgScore))}
            detail="de 0 a 100, calculada pela Garmin"
          />
          <StatTile
            label="VFC noturna média"
            value={s.avgHrv == null ? DASH : `${Math.round(s.avgHrv)} ms`}
            detail={
              hrvRange?.hrvBalancedLow != null && hrvRange.hrvBalancedUpper != null
                ? `sua faixa equilibrada hoje: ${hrvRange.hrvBalancedLow}–${hrvRange.hrvBalancedUpper} ms`
                : undefined
            }
          />
          <StatTile
            label="Horário médio"
            value={
              s.avgBedtime == null || s.avgWake == null
                ? DASH
                : `${formatClock(s.avgBedtime)} → ${formatClock(s.avgWake)}`
            }
            detail="dormir → acordar"
          />
        </div>
      </div>
      <h2 className="section-title">O que o seu sono mostra</h2>
      <InsightsPanel
        insights={generateSleepInsights({ nights })}
        emptyMessage="Ainda não há noites suficientes neste período para observações sobre o seu sono."
      />
      <div className="chart-grid">
        <SleepPhasesChart nights={nights} refreshing={refreshing} />
      </div>
    </>
  );
}
