import { useMemo, useState } from "react";
import { useWellness } from "../api/wellness";
import { SleepScoreChart, SleepStagesChart } from "../components/charts/SleepCharts";
import { ErrorBanner } from "../components/ErrorBanner";
import { InsightsPanel } from "../components/InsightsPanel";
import { StatTile } from "../components/StatTile";
import { formatTotalTime } from "../lib/format";
import { toIsoDate } from "../lib/runStats";
import { sleepInsights, sleepStats } from "../lib/sleep";

const PERIODS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 180, label: "6 meses" },
];
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SleepPage({ today = new Date() }: { today?: Date }) {
  const todayIso = toIsoDate(today);
  const [span, setSpan] = useState(30);
  const { data, error, isPending, isPlaceholderData, refetch } = useWellness(
    shiftDay(todayIso, -(span - 1)),
    todayIso,
  );
  const days = useMemo(() => data ?? [], [data]);
  const stats = useMemo(() => sleepStats(days), [days]);
  const insights = useMemo(() => sleepInsights(days), [days]);

  return (
    <section>
      <h1>Sono</h1>
      <div className="toolbar" role="group" aria-label="Período">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            aria-pressed={p.days === span}
            onClick={() => setSpan(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="stat-grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="stat-tile skeleton" style={{ height: "5.5rem" }} />
          ))}
        </div>
      ) : !stats ? (
        <p className="panel muted">Nenhuma noite registrada neste período.</p>
      ) : (
        <>
          <div
            className={`stat-grid${isPlaceholderData ? " is-refreshing" : ""}`}
            role="group"
            aria-label="Resumo do sono"
          >
            <StatTile
              label="Média por noite"
              value={formatTotalTime(stats.avgTotalS)}
              detail={`${stats.nights} noites`}
            />
            <StatTile
              label="Nota média"
              value={stats.avgScore != null ? String(stats.avgScore) : "—"}
            />
            <StatTile label="Noites com 7 h ou mais" value={pct(stats.shareAtLeast7h)} />
            <StatTile label="Horário médio de dormir" value={stats.avgBedtime ?? "—"} />
            <StatTile label="Sono profundo" value={pct(stats.deepShare)} detail="típico 16–33%" />
            <StatTile label="Sono REM" value={pct(stats.remShare)} detail="típico 21–31%" />
          </div>

          <h2 className="section-title">O que o seu sono mostra</h2>
          <InsightsPanel insights={insights} />

          <h2 className="section-title">Noite a noite</h2>
          <div className="chart-grid">
            <SleepStagesChart days={days} refreshing={isPlaceholderData} />
            <SleepScoreChart days={days} refreshing={isPlaceholderData} />
          </div>
        </>
      )}
    </section>
  );
}
