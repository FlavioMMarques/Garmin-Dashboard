import { useState, type ReactNode } from "react";
import { ErrorBanner } from "../components/ErrorBanner";
import { PAGE_SIZE, useActivities, type ActivitySummary } from "../api/activities";
import {
  activityTypeLabel,
  formatDistance,
  formatDuration,
  formatLocalDateTime,
  formatSpeedFor,
  formatTotalTime,
  usesPace,
} from "../lib/format";
import { RunSplits } from "../components/RunSplits";
import { useProfile } from "../api/profile";
import { weekStart, weekStartsOnFrom } from "../lib/volume";

const COLUMNS = [
  "Atividade",
  "Distância",
  "Duração",
  "Ritmo / velocidade",
  "FC média",
  "Calorias",
  "Detalhes",
];
const NUMERIC_FROM = 1;

const kmFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const shortDay = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = (iso: string) =>
  shortDay.format(new Date(`${iso}T12:00:00Z`)).replace(/ de /g, " ").replace(/\./g, "");
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Consecutive activities of the same week, newest first (the API's order). */
function groupByWeek(items: ActivitySummary[], startsOn: number) {
  const groups: { week: string; items: ActivitySummary[] }[] = [];
  for (const a of items) {
    const week = weekStart(a.startLocal, startsOn);
    const last = groups.at(-1);
    if (last?.week === week) last.items.push(a);
    else groups.push({ week, items: [a] });
  }
  return groups;
}

/** Stroke icon per sport family (decorative). */
function SportIcon({ type }: { type: string }) {
  const family = /running/.test(type)
    ? "run"
    : /walking|hiking/.test(type)
      ? "walk"
      : /cycling|biking/.test(type)
        ? "bike"
        : /swim/.test(type)
          ? "swim"
          : "other";
  const paths: Record<string, ReactNode> = {
    run: (
      <>
        <circle cx="13" cy="4" r="2" />
        <path d="M4 22l4-7 3 2 2-5 4 3 3-1" />
        <path d="M9 9l3-2 3 3" />
      </>
    ),
    walk: (
      <>
        <circle cx="12" cy="4" r="2" />
        <path d="M10 22l1-7-2-3 1-4 4 2 2 3" />
        <path d="M14 15l2 7" />
      </>
    ),
    bike: (
      <>
        <circle cx="6" cy="17" r="4" />
        <circle cx="18" cy="17" r="4" />
        <path d="M6 17l4-8h5l3 8M10 9l2 8" />
      </>
    ),
    swim: <path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M8 13l4-6 4 4" />,
    other: <circle cx="12" cy="12" r="8" />,
  };
  return (
    <span className={`sport-icon sport-${family}`} aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[family]}
      </svg>
    </span>
  );
}

export function ActivitiesPage() {
  const [page, setPage] = useState(0);
  const { data, error, isPending, isPlaceholderData, isFetching, refetch } = useActivities(page);
  const startsOn = weekStartsOnFrom(useProfile().data?.firstDayOfWeek);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Atividades</h1>
          <p className="page-subtitle">Todas as atividades do relógio, agrupadas por semana</p>
        </div>
      </div>

      <div className="toolbar">
        <button
          type="button"
          onClick={() => setPage((p) => p - 1)}
          disabled={page === 0 || isFetching}
        >
          ← Anterior
        </button>
        <span className="muted" aria-live="polite">
          Página {page + 1}
          {isFetching && !isPending ? " · carregando…" : ""}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          disabled={!data?.hasMore || isPlaceholderData || isFetching}
        >
          Próxima →
        </button>
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="panel table-wrap">
          <table className="data-table activities-table" aria-busy={isFetching}>
            <caption className="visually-hidden">Atividades, página {page + 1}</caption>
            <thead>
              <tr>
                {COLUMNS.map((c, i) => (
                  <th key={c} scope="col" className={i >= NUMERIC_FROM ? "num" : undefined}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <SkeletonRows />
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="muted">
                    Nenhuma atividade encontrada.
                  </td>
                </tr>
              ) : (
                groupByWeek(data.items, startsOn).map((g) => (
                  <WeekGroup key={g.week} week={g.week} items={g.items} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function WeekGroup({ week, items }: { week: string; items: ActivitySummary[] }) {
  const km = items.reduce((t, a) => t + (a.distanceM ?? 0), 0) / 1000;
  const seconds = items.reduce((t, a) => t + (a.durationS ?? 0), 0);
  const count = items.length === 1 ? "1 atividade" : `${items.length} atividades`;
  return (
    <>
      <tr className="week-row">
        <th scope="rowgroup" colSpan={COLUMNS.length}>
          <span>
            Semana de {dayLabel(week)} a {dayLabel(addDays(week, 6))}
          </span>
          <span className="muted">
            {count} · {kmFmt.format(km)} km · {formatTotalTime(seconds)}
          </span>
        </th>
      </tr>
      {items.map((a) => (
        <ActivityRow key={a.id} activity={a} />
      ))}
    </>
  );
}

function ActivityRow({ activity: a }: { activity: ActivitySummary }) {
  const [open, setOpen] = useState(false);
  const isRun = usesPace(a.type);
  return (
    <>
      <tr>
        <td>
          <div className="activity-cell">
            <SportIcon type={a.type} />
            <div>
              <div className="activity-name">{a.name || "—"}</div>
              <div className="activity-meta">
                {formatLocalDateTime(a.startLocal)} · {activityTypeLabel(a.type)}
              </div>
            </div>
          </div>
        </td>
        <td className="num">{formatDistance(a.distanceM)}</td>
        <td className="num">{formatDuration(a.durationS)}</td>
        <td className="num">{formatSpeedFor(a.type, a.avgSpeedMps)}</td>
        <td className="num">{a.avgHr != null ? `${Math.round(a.avgHr)} bpm` : "—"}</td>
        <td className="num">{a.calories != null ? `${Math.round(a.calories)} kcal` : "—"}</td>
        <td className="num">
          {isRun && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`splits-${a.id}`}
              className={open ? "is-open" : undefined}
              onClick={() => setOpen((o) => !o)}
            >
              Km a km
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr id={`splits-${a.id}`}>
          <td colSpan={COLUMNS.length} className="details-cell">
            <RunSplits id={a.id} name={a.name} />
          </td>
        </tr>
      )}
    </>
  );
}

function SkeletonRows() {
  return Array.from({ length: Math.min(PAGE_SIZE, 8) }, (_, i) => (
    <tr key={i} aria-hidden="true">
      {COLUMNS.map((c) => (
        <td key={c}>
          <div className="skeleton" style={{ height: "1em" }} />
        </td>
      ))}
    </tr>
  ));
}
