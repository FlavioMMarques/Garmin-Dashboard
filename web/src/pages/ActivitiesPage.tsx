import { useState } from "react";
import { PAGE_SIZE, useActivities, type ActivitySummary } from "../api/activities";
import {
  activityTypeLabel,
  formatDistance,
  formatDuration,
  formatLocalDateTime,
  formatSpeedFor,
} from "../lib/format";

const COLUMNS = [
  "Data",
  "Tipo",
  "Nome",
  "Distância",
  "Duração",
  "Ritmo / velocidade",
  "FC média",
  "Calorias",
];
const NUMERIC_FROM = 3;

export function ActivitiesPage() {
  const [page, setPage] = useState(0);
  const { data, error, isPending, isPlaceholderData, isFetching } = useActivities(page);

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
        <p className="banner-error" role="alert">
          {error.message}
        </p>
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
  return (
    <tr>
      <td className="num nowrap">{formatLocalDateTime(a.startLocal)}</td>
      <td className="nowrap">{activityTypeLabel(a.type)}</td>
      <td>{a.name || "—"}</td>
      <td className="num">{formatDistance(a.distanceM)}</td>
      <td className="num">{formatDuration(a.durationS)}</td>
      <td className="num">{formatSpeedFor(a.type, a.avgSpeedMps)}</td>
      <td className="num">{a.avgHr != null ? `${Math.round(a.avgHr)} bpm` : "—"}</td>
      <td className="num">{a.calories != null ? `${Math.round(a.calories)} kcal` : "—"}</td>
    </tr>
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
