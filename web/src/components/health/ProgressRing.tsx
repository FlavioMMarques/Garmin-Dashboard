interface Props {
  /** 0–1; values above 1 draw a full ring. */
  progress: number | null;
  size?: number;
  stroke?: number;
  /** Text in the middle (e.g. "61%"); decorative when `label` is given. */
  center?: string;
  /** Accessible description; without it the ring is decorative. */
  label?: string;
  muted?: boolean;
}

/** Goal progress as a ring (steps against the daily goal). */
export function ProgressRing({ progress, size = 120, stroke = 12, center, label, muted }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress ?? 0));
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        {p > 0 && (
          <circle
            className={muted ? "ring-value is-muted" : "ring-value"}
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={`${p * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {center && (
        <span className="ring-center" aria-hidden="true">
          {center}
        </span>
      )}
    </span>
  );
}
