import { useMemo, useState } from "react";
import { useRuns } from "../api/runs";
import { StatTile } from "../components/StatTile";
import { paceDelta, percentDelta } from "../lib/delta";
import { formatDistance, formatKmTotal, formatPace, formatTotalTime } from "../lib/format";
import { PERIODS, periodRange, splitAt, summarize, type Period } from "../lib/runStats";

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
  const { data, error, isPending, isFetching } = useRuns(range.prevFrom);

  const { current, totals, prevTotals } = useMemo(() => {
    const { current, previous } = splitAt(data ?? [], range.from);
    return { current, totals: summarize(current), prevTotals: summarize(previous) };
  }, [data, range.from]);

  const hasBaseline = period !== "all";
  const vs = PREVIOUS_LABEL[period];

  return (
    <section>
      <h1>Corrida</h1>

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

      {error ? (
        <p className="banner-error" role="alert">
          {error.message}
        </p>
      ) : isPending ? (
        <div className="stat-grid" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="stat-tile skeleton" style={{ height: "5.5rem" }} />
          ))}
        </div>
      ) : current.length === 0 ? (
        <p className="panel muted">Nenhuma corrida neste período.</p>
      ) : (
        <div className="stat-grid">
          <StatTile
            label="Corridas"
            value={String(totals.count)}
            delta={hasBaseline ? percentDelta(totals.count, prevTotals.count) : null}
            deltaLabel={vs}
          />
          <StatTile
            label="Distância"
            value={formatKmTotal(totals.distanceM)}
            delta={hasBaseline ? percentDelta(totals.distanceM, prevTotals.distanceM) : null}
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
      )}
    </section>
  );
}
