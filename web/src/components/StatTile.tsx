import type { Delta } from "../lib/delta";

const ARROWS = { up: "▲", down: "▼", flat: "■" } as const;
const TONE_WORDS = { good: "melhora", bad: "piora", neutral: "estável" } as const;

interface Props {
  label: string;
  value: string;
  delta?: Delta | null;
  /** What the delta compares against, e.g. "vs 6 meses anteriores". */
  deltaLabel?: string;
}

export function StatTile({ label, value, delta, deltaLabel }: Props) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta && (
        <div className={`stat-delta tone-${delta.tone}`}>
          <span aria-hidden="true">{ARROWS[delta.direction]} </span>
          {delta.text}
          <span className="visually-hidden"> ({TONE_WORDS[delta.tone]})</span>
          {deltaLabel && <span className="stat-delta-label">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
