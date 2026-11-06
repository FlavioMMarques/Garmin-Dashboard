import { useMemo, useState } from "react";
import { ErrorBanner } from "../components/ErrorBanner";
import { useRuns } from "../api/runs";
import { StatTile } from "../components/StatTile";
import { paceDelta, percentDelta } from "../lib/delta";
import { formatDistance, formatKmTotal, formatPace, formatTotalTime } from "../lib/format";
import { PERIODS, periodRange, splitAt, summarize, toIsoDate, type Period } from "../lib/runStats";
import {
  monthlyVolume,
  weekRangeLabel,
  weekStartsOnFrom,
  weeklyVolume,
  yearToDate,
} from "../lib/volume";
import { useProfile } from "../api/profile";
import { paceSeries } from "../lib/pace";
import { PaceChart } from "../components/charts/PaceChart";
import { EfficiencyChart } from "../components/charts/EfficiencyChart";
import { efficiencySeries, monthlyBests, BEST_DISTANCES } from "../lib/performance";
import { BestsChart } from "../components/charts/BestsChart";
import { BestEffortTiles } from "../components/BestEffortTiles";
import { TrainingPaces } from "../components/TrainingPaces";
import { CrossInsights } from "../components/CrossInsights";
import { InsightsPanel } from "../components/InsightsPanel";
import { generateInsights } from "../lib/insights";
import { ZonesChart } from "../components/charts/ZonesChart";
import { labelCounts, weeklyZones, zoneShare } from "../lib/training";
import { TrainingTypesChart } from "../components/charts/TrainingTypesChart";
import { HeatChart } from "../components/charts/HeatChart";
import { DynamicsChart } from "../components/charts/DynamicsChart";
import {
  MonthlyVolumeChart,
  WeeklyVolumeChart,
  YearToDateChart,
} from "../components/charts/VolumeCharts";

const PACE_WINDOW = 5;
/** Weeks drawn in the hero tile's sparkline. */
const SPARK_WEEKS = 12;

const SECTIONS = [
  { id: "secao-evolucao", label: "Evolução" },
  { id: "secao-marcas", label: "Melhores marcas" },
  { id: "secao-treino", label: "Treino" },
  { id: "secao-dinamica", label: "Dinâmica" },
  { id: "secao-volume", label: "Volume" },
] as const;

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
/** "YYYY-MM-DD" → local Date. */
const parseIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
/** "6 de mai. – 5 de nov. de 2026" without the "de" clutter: "6 mai – 5 nov 2026". */
const shortDate = (fmt: Intl.DateTimeFormat, d: Date) =>
  fmt.format(d).replace(/ de /g, " ").replace(/\./g, "");

function scrollToSection(id: string) {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
}

/** Last weeks' km as small bars; the current week stands out. */
function WeeklySpark({ weeks }: { weeks: { weekStart: string; km: number }[] }) {
  const last = weeks.slice(-SPARK_WEEKS);
  if (last.length < 2) return null;
  const max = Math.max(...last.map((w) => w.km), 1);
  const slot = 240 / last.length;
  const current = last.at(-1)!;
  const kmFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  return (
    <div className="hero-spark">
      <svg
        viewBox="0 0 240 56"
        width="100%"
        height="56"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Volume das últimas ${last.length} semanas; esta semana, ${kmFmt.format(current.km)} km`}
      >
        {last.map((w, i) => {
          const h = Math.max((w.km / max) * 52, w.km > 0 ? 2 : 0);
          return (
            <rect
              key={w.weekStart}
              x={i * slot + slot * 0.15}
              y={56 - h}
              width={slot * 0.7}
              height={h}
              rx="2"
              className={i === last.length - 1 ? "spark-current" : "spark-bar"}
            />
          );
        })}
      </svg>
      <div className="hero-spark-legend" aria-hidden="true">
        <span>{last.length} semanas atrás</span>
        <span>Esta semana · {kmFmt.format(current.km)} km</span>
      </div>
    </div>
  );
}

const PREVIOUS_LABEL: Record<Period, string> = {
  "3m": "vs 3 meses anteriores",
  "6m": "vs 6 meses anteriores",
  "1y": "vs ano anterior",
  all: "",
};

export function RunningPage({ today = new Date() }: { today?: Date }) {
  const [period, setPeriod] = useState<Period>("6m");
  const range = periodRange(period, today);
  // Fetch from the start of the previous window so tiles can show the change.
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useRuns(
    range.prevFrom,
  );
  // Year-to-date compares with the whole previous calendar year, independent of the period.
  const todayIso = toIsoDate(today);
  // Weeks follow the user's Garmin preference (e.g. Sunday–Saturday).
  const weekStartsOn = weekStartsOnFrom(useProfile().data?.firstDayOfWeek);
  const year = today.getFullYear();
  const ytdQuery = useRuns(`${year - 1}-01-01`);

  const { current, previous, totals, prevTotals } = useMemo(() => {
    const { current, previous } = splitAt(data ?? [], range.from);
    return { current, previous, totals: summarize(current), prevTotals: summarize(previous) };
  }, [data, range.from]);

  const charts = useMemo(
    () => ({
      weeks: weeklyVolume(current, range.from, todayIso, weekStartsOn),
      months: monthlyVolume(current, range.from, todayIso),
      pace: paceSeries(current, PACE_WINDOW),
      efficiency: efficiencySeries(current, PACE_WINDOW),
      zones: weeklyZones(current, range.from, todayIso, weekStartsOn),
      zoneShare: zoneShare(current),
      labels: labelCounts(current),
      bests: BEST_DISTANCES.map((d) => ({ distance: d.id, months: monthlyBests(current, d.id) })),
    }),
    [current, range.from, todayIso, weekStartsOn],
  );
  const insights = useMemo(
    () =>
      generateInsights({
        current,
        previous: period === "all" ? [] : previous,
        from: range.from,
        today: todayIso,
        window: PACE_WINDOW,
        weekStartsOn,
      }),
    [current, previous, period, range.from, todayIso, weekStartsOn],
  );
  const ytd = useMemo(
    () => (ytdQuery.data ? yearToDate(ytdQuery.data, todayIso) : null),
    [ytdQuery.data, todayIso],
  );

  const hasBaseline = period !== "all";
  const vs = PREVIOUS_LABEL[period];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Corrida</h1>
          <p className="page-subtitle">
            {range.from
              ? `${shortDate(dayMonth, parseIso(range.from))} – ${shortDate(dayMonthYear, today)} · comparado com o período anterior`
              : "Todo o histórico"}
          </p>
        </div>
        <div className="toolbar" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === period}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
          {isFetching && !isPending && <span className="muted">carregando…</span>}
        </div>
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="stat-grid" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="stat-tile skeleton" style={{ height: "5.5rem" }} />
          ))}
        </div>
      ) : current.length === 0 ? (
        <p className="panel muted">Nenhuma corrida neste período.</p>
      ) : (
        <>
          <div
            className={`kpi-row${isPlaceholderData ? " is-refreshing" : ""}`}
            role="group"
            aria-label="Resumo do período"
          >
            <StatTile
              variant="hero"
              label="Distância"
              value={formatKmTotal(totals.distanceM)}
              delta={hasBaseline ? percentDelta(totals.distanceM, prevTotals.distanceM) : null}
              deltaLabel={vs}
            >
              <WeeklySpark weeks={charts.weeks} />
            </StatTile>
            <div className="kpi-grid">
              <StatTile
                label="Corridas"
                value={String(totals.count)}
                delta={hasBaseline ? percentDelta(totals.count, prevTotals.count) : null}
                deltaLabel={vs}
              />
              <StatTile
                label="Tempo correndo"
                value={formatTotalTime(totals.movingS)}
                delta={hasBaseline ? percentDelta(totals.movingS, prevTotals.movingS) : null}
                deltaLabel={vs}
              />
              <StatTile
                label="Ritmo médio"
                value={formatPace(totals.avgSpeedMps)}
                delta={hasBaseline ? paceDelta(totals.avgSpeedMps, prevTotals.avgSpeedMps) : null}
                deltaLabel={vs}
              />
              <StatTile
                label="Maior corrida"
                value={formatDistance(totals.longestM)}
                delta={hasBaseline ? percentDelta(totals.longestM, prevTotals.longestM) : null}
                deltaLabel={vs}
              />
            </div>
          </div>
          <h2 className="section-title">O que seus treinos mostram</h2>
          <InsightsPanel insights={insights} limit={3} />
          <CrossInsights runs={current} from={range.from} today={todayIso} />

          <nav className="section-nav" aria-label="Ir para a seção">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => scrollToSection(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>

          <h2 className="section-title" id="secao-evolucao">
            Evolução
          </h2>
          <div className="chart-grid">
            <PaceChart points={charts.pace} window={PACE_WINDOW} refreshing={isPlaceholderData} />
            <EfficiencyChart
              points={charts.efficiency}
              window={PACE_WINDOW}
              refreshing={isPlaceholderData}
            />
          </div>

          <h2 className="section-title" id="secao-marcas">
            Melhores marcas
          </h2>
          <BestEffortTiles current={current} previous={previous} deltaLabel={vs} />
          <div className="chart-grid">
            <BestsChart series={charts.bests} refreshing={isPlaceholderData} />
            <TrainingPaces runs={current} />
          </div>

          <h2 className="section-title" id="secao-treino">
            Treino
          </h2>
          <div className="chart-grid">
            <ZonesChart
              weeks={charts.zones}
              share={charts.zoneShare}
              refreshing={isPlaceholderData}
            />
            <TrainingTypesChart counts={charts.labels} refreshing={isPlaceholderData} />
            <HeatChart runs={current} refreshing={isPlaceholderData} />
          </div>

          <h2 className="section-title" id="secao-dinamica">
            Dinâmica
          </h2>
          <div className="chart-grid">
            <DynamicsChart runs={current} window={PACE_WINDOW} refreshing={isPlaceholderData} />
          </div>

          <h2 className="section-title" id="secao-volume">
            Volume
          </h2>
          <div className="chart-grid">
            <WeeklyVolumeChart
              weeks={charts.weeks}
              weekLabel={weekRangeLabel(weekStartsOn)}
              refreshing={isPlaceholderData}
            />
            <MonthlyVolumeChart months={charts.months} refreshing={isPlaceholderData} />
            {ytd && <YearToDateChart ytd={ytd} />}
          </div>
        </>
      )}
    </section>
  );
}
