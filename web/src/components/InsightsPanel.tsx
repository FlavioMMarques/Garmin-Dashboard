import type { Insight, InsightTone } from "../lib/insights";

// `tag` repeats the group heading on each card (aria-hidden: the heading already says it).
const GROUPS: { tone: InsightTone; icon: string; label: string; tag: string }[] = [
  { tone: "attention", icon: "!", label: "Atenção", tag: "Atenção" },
  { tone: "positive", icon: "✓", label: "Pontos positivos", tag: "Ponto positivo" },
  { tone: "info", icon: "i", label: "Observações", tag: "Observação" },
];

/**
 * Every observation about the selected period, grouped by tone. Tone is carried by the
 * group heading (text) and an icon; status colors only ever accompany them.
 */
export function InsightsPanel({
  insights,
  emptyMessage = "Ainda não há dados suficientes neste período para observações sobre os seus treinos.",
}: {
  insights: Insight[];
  emptyMessage?: string;
}) {
  if (insights.length === 0) return <p className="panel muted">{emptyMessage}</p>;
  return (
    <div className="insight-groups">
      {GROUPS.map((g) => {
        const items = insights.filter((i) => i.tone === g.tone);
        if (items.length === 0) return null;
        return (
          <section key={g.tone} aria-labelledby={`insights-${g.tone}`}>
            <h3 id={`insights-${g.tone}`} className="insight-group-title">
              {g.label} <span className="muted">({items.length})</span>
            </h3>
            <ul className="insights">
              {items.map((i) => (
                <li key={i.id} className={`insight insight-${i.tone}`}>
                  <span className="insight-tag" aria-hidden="true">
                    <span className="insight-icon">{g.icon}</span>
                    {g.tag}
                  </span>
                  <div>
                    <h4 className="insight-title">{i.title}</h4>
                    <p className="insight-detail">{i.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
