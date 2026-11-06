import { useRunSplits, type KmSplit } from "../api/runs";
import { formatDecimal } from "../lib/format";
import { generateSplitInsights, paceText } from "../lib/splitInsights";
import { InsightsPanel } from "./InsightsPanel";

const DASH = "—";
const COLUMNS = ["Km", "Ritmo", "FC média", "Cadência", "Subida"];

const kmLabel = (s: KmSplit) =>
  s.partial ? `Final (${formatDecimal(s.distanceM / 1000)} km)` : String(s.km);

/** Kilometre-by-kilometre table of one run, plus what it shows. */
export function RunSplits({ id, name }: { id: number; name: string }) {
  const { data, error, isPending, refetch } = useRunSplits(id, true);

  if (isPending) {
    return (
      <p role="status" className="muted">
        Lendo o arquivo da corrida…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="muted">
        Não foi possível ler o arquivo desta corrida.{" "}
        <button type="button" onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </p>
    );
  }
  if (data.length === 0) {
    return <p className="muted">Esta corrida não tem distância registrada para dividir em km.</p>;
  }

  // Pace bars: longest = fastest km, scaled between the slowest and fastest full km.
  const paces = data.filter((s) => !s.partial).map((s) => s.paceSecPerKm);
  const fastest = paces.length ? Math.min(...paces) : null;
  const slowest = paces.length ? Math.max(...paces) : null;
  const barWidth = (pace: number | null) => {
    if (pace == null || fastest == null || slowest == null) return 0;
    if (slowest === fastest) return 100;
    return 25 + (75 * (slowest - pace)) / (slowest - fastest);
  };

  return (
    <div className="run-splits">
      <div className="table-wrap">
        <table className="data-table">
          <caption className="visually-hidden">Km a km: {name || "corrida"}</caption>
          <thead>
            <tr>
              {COLUMNS.map((c, i) => (
                <th key={c} scope="col" className={i > 0 ? "num" : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.km}>
                <th scope="row">{kmLabel(s)}</th>
                <td className="num split-pace">
                  <span className="split-bar" aria-hidden="true">
                    <span
                      className={s.paceSecPerKm === fastest ? "is-fastest" : undefined}
                      style={{ width: `${barWidth(s.partial ? null : s.paceSecPerKm)}%` }}
                    />
                  </span>
                  <span>{paceText(s.paceSecPerKm)}</span>
                </td>
                <td className="num">{s.avgHr == null ? DASH : `${s.avgHr} bpm`}</td>
                <td className="num">
                  {s.cadenceSpm == null ? DASH : `${s.cadenceSpm} passos/min`}
                </td>
                <td className="num">{s.elevationGainM == null ? DASH : `${s.elevationGainM} m`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InsightsPanel
        insights={generateSplitInsights(data)}
        emptyMessage="Corrida curta demais para observações km a km (são precisos 3 km completos)."
      />
    </div>
  );
}
