import type { Night } from "../../api/sleep";
import { formatTotalTime } from "../../lib/format";

const PHASES = [
  { field: "deepSeconds", label: "Profundo", cls: "phase-deep" },
  { field: "lightSeconds", label: "Leve", cls: "phase-light" },
  { field: "remSeconds", label: "REM", cls: "phase-rem" },
  { field: "awakeSeconds", label: "Acordado", cls: "phase-awake" },
] as const;

/** One night's phases as a single stacked bar, with time and share per phase. */
export function PhaseBar({ night }: { night: Night }) {
  const parts = PHASES.map((p) => ({ ...p, seconds: night[p.field] ?? 0 }));
  const total = parts.reduce((a, p) => a + p.seconds, 0);
  if (total === 0) return null;
  const asleep = total - (night.awakeSeconds ?? 0);
  return (
    <div className="phase">
      <div className="phase-bar" aria-hidden="true">
        {parts
          .filter((p) => p.seconds > 0)
          .map((p) => (
            <span
              key={p.field}
              className={p.cls}
              style={{ width: `${(p.seconds / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="phase-legend">
        {parts.map((p) => (
          <li key={p.field}>
            <span className="phase-key">
              <span className={`phase-swatch ${p.cls}`} aria-hidden="true" />
              {p.label}
            </span>
            <strong>
              {formatTotalTime(p.seconds)}
              {p.field !== "awakeSeconds" && asleep > 0 && (
                <> · {Math.round((p.seconds / asleep) * 100)}%</>
              )}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
