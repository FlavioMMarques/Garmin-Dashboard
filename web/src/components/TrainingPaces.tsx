import type { RunSummary } from "../api/runs";
import { predictRaceTime, trainingPaces } from "../lib/daniels";
import { formatDecimal, formatDuration, formatPace } from "../lib/format";
import { BEST_DISTANCES, vdotFromRuns } from "../lib/performance";

const pace = (secPerKm: number) => formatPace(1000 / secPerKm);
const RACES = [
  { label: "5 km", meters: 5000 },
  { label: "10 km", meters: 10000 },
  { label: "21 km", meters: 21097.5 },
  { label: "42 km", meters: 42195 },
];

/** Daniels training paces and race-time equivalents for the period's estimated VDOT. */
export function TrainingPaces({ runs }: { runs: RunSummary[] }) {
  const best = vdotFromRuns(runs);
  if (!best) {
    return (
      <section className="chart-card" aria-labelledby="paces-title">
        <h3 id="paces-title">Ritmos sugeridos e previsões</h3>
        <p className="chart-subtitle">
          Precisa de pelo menos um esforço de 5 km ou mais no período para estimar o VDOT.
        </p>
      </section>
    );
  }
  const p = trainingPaces(best.value);
  const source = BEST_DISTANCES.find((d) => d.id === best.distance)!.label;

  return (
    <section className="chart-card" aria-labelledby="paces-title">
      <h3 id="paces-title">Ritmos sugeridos e previsões</h3>
      <p className="chart-subtitle">
        Pelas tabelas de Jack Daniels para VDOT {formatDecimal(best.value, 1)} (estimativa, de{" "}
        {source} em {formatDuration(best.effort.seconds)}). Previsões supõem preparo específico para
        a distância.
      </p>
      <div className="paces-grid">
        <dl className="paces-list">
          <dt>Leve / longão</dt>
          <dd>
            {pace(p.easy.fast)} – {pace(p.easy.slow)}
          </dd>
          <dt>Maratona</dt>
          <dd>{pace(p.marathon)}</dd>
          <dt>Limiar</dt>
          <dd>{pace(p.threshold)}</dd>
          <dt>Intervalado</dt>
          <dd>{pace(p.interval)}</dd>
        </dl>
        <dl className="paces-list">
          {RACES.map((r) => (
            <div key={r.label} className="paces-row">
              <dt>{r.label}</dt>
              <dd>{formatDuration(predictRaceTime(best.value, r.meters))}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
