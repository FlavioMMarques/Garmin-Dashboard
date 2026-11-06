import { useState } from "react";
import type { Insight, InsightTone } from "../lib/insights";

// `tag` repeats the tone on each card. In the grouped view the group heading already says
// it, so the tag is decorative there; in the compact view it is the only label.
const GROUPS: { tone: InsightTone; icon: string; label: string; tag: string }[] = [
  { tone: "attention", icon: "!", label: "Atenção", tag: "Atenção" },
  { tone: "positive", icon: "✓", label: "Pontos positivos", tag: "Ponto positivo" },
  { tone: "info", icon: "i", label: "Observações", tag: "Observação" },
];
const BY_TONE = Object.fromEntries(GROUPS.map((g) => [g.tone, g])) as Record<
  InsightTone,
  (typeof GROUPS)[number]
>;

function InsightCard({ insight: i, tagHidden }: { insight: Insight; tagHidden: boolean }) {
  const g = BY_TONE[i.tone];
  return (
    <li className={`insight insight-${i.tone}`}>
      <span className="insight-tag" aria-hidden={tagHidden || undefined}>
        <span className="insight-icon" aria-hidden="true">
          {g.icon}
        </span>
        {g.tag}
        {!tagHidden && <span className="visually-hidden">:</span>}
      </span>
      <div>
        <h4 className="insight-title">{i.title}</h4>
        <p className="insight-detail">{i.detail}</p>
      </div>
    </li>
  );
}

/**
 * Every observation about the selected period, grouped by tone. Tone is carried by text
 * (heading or tag) and an icon; status colors only ever accompany them.
 *
 * With `limit`, the panel opens compact: the first `limit` observations by priority
 * (attention first), and a button to see them all, grouped.
 */
export function InsightsPanel({
  insights,
  emptyMessage = "Ainda não há dados suficientes neste período para observações sobre os seus treinos.",
  limit,
}: {
  insights: Insight[];
  emptyMessage?: string;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (insights.length === 0) return <p className="panel muted">{emptyMessage}</p>;

  if (limit != null && insights.length > limit && !expanded) {
    const top = GROUPS.flatMap((g) => insights.filter((i) => i.tone === g.tone)).slice(0, limit);
    return (
      <div className="insight-groups">
        <ul className="insights">
          {top.map((i) => (
            <InsightCard key={i.id} insight={i} tagHidden={false} />
          ))}
        </ul>
        <button type="button" className="link-button" onClick={() => setExpanded(true)}>
          Ver todas as {insights.length} observações
        </button>
      </div>
    );
  }

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
                <InsightCard key={i.id} insight={i} tagHidden />
              ))}
            </ul>
          </section>
        );
      })}
      {limit != null && expanded && (
        <button type="button" className="link-button" onClick={() => setExpanded(false)}>
          Mostrar só as principais
        </button>
      )}
    </div>
  );
}
