export interface Delta {
  text: string;
  direction: "up" | "down" | "flat";
  /** Whether the change is good for the runner, not whether the number went up. */
  tone: "good" | "bad" | "neutral";
}

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0, signDisplay: "exceptZero" });

/** Percent change vs the previous period; null when there is nothing to compare to. */
export function percentDelta(current: number, previous: number, upIsGood = true): Delta | null {
  if (!(previous > 0)) return null;
  const change = current / previous - 1;
  const rounded = Math.round(change * 100);
  if (rounded === 0) return { text: "0%", direction: "flat", tone: "neutral" };
  const up = rounded > 0;
  return {
    text: `${pct.format(rounded).replace("-", "−")}%`,
    direction: up ? "up" : "down",
    tone: up === upIsGood ? "good" : "bad",
  };
}

/** Pace change in s/km: faster (lower pace) is good. */
export function paceDelta(currentMps: number | null, previousMps: number | null): Delta | null {
  if (!currentMps || !previousMps) return null;
  const diff = Math.round(1000 / currentMps - 1000 / previousMps);
  if (diff === 0) return { text: "0:00 /km", direction: "flat", tone: "neutral" };
  const abs = Math.abs(diff);
  const text = `${diff < 0 ? "−" : "+"}${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, "0")} /km`;
  return { text, direction: diff < 0 ? "down" : "up", tone: diff < 0 ? "good" : "bad" };
}

/** Change in a duration (s): lower is good (a faster best effort). */
export function durationDelta(current: number | null, previous: number | null): Delta | null {
  if (!current || !previous) return null;
  const diff = Math.round(current - previous);
  if (diff === 0) return { text: "0:00", direction: "flat", tone: "neutral" };
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = (abs % 60).toString().padStart(2, "0");
  const body = h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
  return {
    text: `${diff < 0 ? "−" : "+"}${body}`,
    direction: diff < 0 ? "down" : "up",
    tone: diff < 0 ? "good" : "bad",
  };
}
