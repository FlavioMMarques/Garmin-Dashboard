import { useState } from "react";
import { ErrorBanner } from "../components/ErrorBanner";
import { PAGE_SIZE, useActivities, type ActivitySummary } from "../api/activities";
import {
  activityTypeLabel,
  formatDistance,
  formatDuration,
  formatLocalDateTime,
  formatSpeedFor,
  usesPace,
} from "../lib/format";
import { RunSplits } from "../components/RunSplits";

const COLUMNS = [
  "Data",
  "Tipo",
  "Nome",
  "Distância",
  "Duração",
  "Ritmo / velocidade",
  "FC média",
  "Calorias",
  "Detalhes",
];
const NUMERIC_FROM = 3;

export function ActivitiesPage() {
  const [page, setPage] = useState(0);
  const { data, error, isPending, isPlaceholderData, isFetching, refetch } = useActivities(page);

  return (
    <section>
      <h1>Atividades</h1>

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
          <table className="data-table" aria-busy={isFetching}>
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
                data.items.map((a) => <ActivityRow key={a.id} activity={a} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ActivityRow({ activity: a }: { activity: ActivitySummary }) {
  const [open, setOpen] = useState(false);
  const isRun = usesPace(a.type);
  return (
    <>
      <tr>
        <td className="num nowrap">{formatLocalDateTime(a.startLocal)}</td>
        <td className="nowrap">{activityTypeLabel(a.type)}</td>
        <td>{a.name || "—"}</td>
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
