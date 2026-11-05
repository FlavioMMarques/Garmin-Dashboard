import type { RunSummary } from "../api/runs";
import { durationDelta, percentDelta } from "../lib/delta";
import { formatDayMonth, formatDecimal, formatDuration, formatPace } from "../lib/format";
import { BEST_DISTANCES, bestEfforts, vdotFromRuns } from "../lib/performance";
import { StatTile } from "./StatTile";

interface Props {
  current: RunSummary[];
  previous: RunSummary[];
  /** e.g. "vs 6 meses anteriores"; empty when there is no previous window. */
  deltaLabel: string;
}

/** Best time per distance and estimated VDOT for the period, vs the previous window. */
export function BestEffortTiles({ current, previous, deltaLabel }: Props) {
  const now = bestEfforts(current);
  const before = bestEfforts(previous);
  const vdotNow = vdotFromRuns(current);
  const vdotBefore = vdotFromRuns(previous);
  const compare = deltaLabel !== "";
  const vdotSource = vdotNow
    ? `de ${BEST_DISTANCES.find((d) => d.id === vdotNow.distance)!.label} em ${formatDuration(vdotNow.effort.seconds)}`
    : undefined;

  return (
    <div className="stat-grid" role="group" aria-label="Melhores marcas do período">
      {BEST_DISTANCES.filter((d) => now[d.id]).map((d) => {
        const best = now[d.id]!;
        return (
          <StatTile
            key={d.id}
            label={d.label}
            value={formatDuration(best.seconds)}
            detail={`${formatPace(d.meters / best.seconds)} · ${formatDayMonth(best.startLocal)}`}
            delta={compare ? durationDelta(best.seconds, before[d.id]?.seconds ?? null) : null}
            deltaLabel={deltaLabel}
          />
        );
      })}
      {vdotNow && (
        <StatTile
          label="VDOT (estimativa)"
          value={formatDecimal(vdotNow.value, 1)}
          detail={vdotSource}
          delta={compare && vdotBefore ? percentDelta(vdotNow.value, vdotBefore.value) : null}
          deltaLabel={deltaLabel}
        />
      )}
    </div>
  );
}
