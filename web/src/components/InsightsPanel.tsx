import type { Insight, InsightTone } from "../lib/insights";

const TONES: Record<InsightTone, { icon: string; label: string }> = {
  attention: { icon: "!", label: "Atenção" },
  positive: { icon: "✓", label: "Ponto positivo" },
  info: { icon: "i", label: "Observação" },
};

/** Observations about the selected period; tone is carried by icon + label, never color alone. */
export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <p className="panel muted">
        Ainda não há dados suficientes neste período para observações sobre os seus treinos.
      </p>
    );
  }
  return (
    <ul className="insights" aria-label="Observações sobre os seus treinos">
      {insights.map((i) => {
        const tone = TONES[i.tone];
        return (
          <li key={i.id} className={`insight insight-${i.tone}`}>
            <span className="insight-icon" aria-hidden="true">
              {tone.icon}
            </span>
            <div>
              <div className="insight-tone">{tone.label}</div>
              <h3 className="insight-title">{i.title}</h3>
              <p className="insight-detail">{i.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
