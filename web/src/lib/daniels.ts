import { vdot } from "./performance";

/**
 * Velocity (m/min) whose oxygen cost is `vo2` ml/kg/min — the inverse of
 * Daniels & Gilbert's cost curve VO2 = -4.60 + 0.182258·v + 0.000104·v².
 */
function velocityForVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

const secPerKmAt = (fractionOfVdot: number, value: number) =>
  60_000 / velocityForVo2(fractionOfVdot * value);

/** Race time (s) at which an all-out effort over `meters` equals the given VDOT (bisection). */
export function predictRaceTime(value: number, meters: number): number {
  let lo = 60;
  let hi = 8 * 3600;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    // VDOT falls as time grows: too high a VDOT means we're too fast.
    if (vdot(meters, mid) > value) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TrainingPaces {
  /** Easy/long runs: 59–74% of VDOT (s/km; `fast` is the quicker end). */
  easy: { fast: number; slow: number };
  /** Marathon race pace predicted from VDOT. */
  marathon: number;
  /** Threshold (≈ 1 h race effort): 88% of VDOT. */
  threshold: number;
  /** Interval (VO2max): 97.5% of VDOT. */
  interval: number;
}

/** Daniels' training paces (s/km) for a VDOT. */
export function trainingPaces(value: number): TrainingPaces {
  return {
    easy: { fast: secPerKmAt(0.74, value), slow: secPerKmAt(0.59, value) },
    marathon: predictRaceTime(value, 42195) / 42.195,
    threshold: secPerKmAt(0.88, value),
    interval: secPerKmAt(0.975, value),
  };
}
