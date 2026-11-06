interface Props {
  min: number;
  max: number;
  /** Scale bounds (Body Battery and stress are both 0–100). */
  scaleMin?: number;
  scaleMax?: number;
  label: string;
}

/** A low–high span on a fixed scale, e.g. the day's Body Battery from 15 to 70. */
export function RangeBar({ min, max, scaleMin = 0, scaleMax = 100, label }: Props) {
  const span = scaleMax - scaleMin;
  const left = ((min - scaleMin) / span) * 100;
  const width = Math.max(((max - min) / span) * 100, 1);
  return (
    <div className="range">
      <div className="range-track" role="img" aria-label={label}>
        <div className="range-fill" style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
      <div className="range-scale" aria-hidden="true">
        <span>{scaleMin}</span>
        <span>{scaleMax}</span>
      </div>
    </div>
  );
}

const STRESS_BANDS = ["repouso", "baixo", "médio", "alto"] as const;

/** Garmin's stress scale in four bands (0–25 rest … 76–100 high) with the day's mark. */
export function StressGauge({ value }: { value: number }) {
  const band = STRESS_BANDS[Math.min(3, Math.floor(Math.max(0, value - 1) / 25))];
  return (
    <div className="range">
      <div
        className="stress-track"
        role="img"
        aria-label={`${value} numa escala de 0 a 100: faixa ${band}`}
      >
        {STRESS_BANDS.map((b) => (
          <span key={b} className={`stress-band stress-${STRESS_BANDS.indexOf(b)}`} />
        ))}
        <span className="stress-mark" style={{ left: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <div className="range-scale" aria-hidden="true">
        {STRESS_BANDS.map((b) => (
          <span key={b}>{b}</span>
        ))}
      </div>
    </div>
  );
}
