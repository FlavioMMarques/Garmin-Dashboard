import type { BestDistance } from "../api/runs";
import { median } from "./pace";

export const BEST_DISTANCES: { id: BestDistance; label: string; meters: number }[] = [
  { id: "1000", label: "1 km", meters: 1000 },
  { id: "1609", label: "1 milha", meters: 1609.344 },
  { id: "5000", label: "5 km", meters: 5000 },
  { id: "10000", label: "10 km", meters: 10000 },
  { id: "21098", label: "21 km", meters: 21097.5 },
];

/** Efforts long enough for VDOT to be meaningful (short ones overestimate it). */
const VDOT_DISTANCES: BestDistance[] = ["5000", "10000", "21098"];

const metersOf = (d: BestDistance) => BEST_DISTANCES.find((x) => x.id === d)!.meters;

/**
 * Jack Daniels' VDOT (Daniels & Gilbert): oxygen cost of the effort's velocity
 * divided by the fraction of VO2max sustainable for that duration.
 */
export function vdot(meters: number, seconds: number): number {
  const minutes = seconds / 60;
  const v = meters / minutes; // m/min
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const fraction =
    0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
  return vo2 / fraction;
}

interface Run {
  id: number;
  startLocal: string;
  distanceM: number | null;
  avgSpeedMps: number | null;
  avgHr: number | null;
  bestS: Record<BestDistance, number | null>;
}

export interface EfficiencyPoint {
  id: number;
  startLocal: string;
  distanceM: number;
  avgSpeedMps: number;
  avgHr: number;
  /** Meters covered per heartbeat: (m/min) ÷ bpm. Higher = fitter at the same effort. */
  metersPerBeat: number;
  /** Median of the last `window` runs. */
  rolling: number;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function efficiencySeries(runs: Run[], window = 5): EfficiencyPoint[] {
  const recent: number[] = [];
  const points: EfficiencyPoint[] = [];
  for (const r of runs) {
    if (!r.avgSpeedMps || !r.avgHr || !r.distanceM) continue;
    const metersPerBeat = round4((r.avgSpeedMps * 60) / r.avgHr);
    recent.push(metersPerBeat);
    if (recent.length > window) recent.shift();
    points.push({
      id: r.id,
      startLocal: r.startLocal,
      distanceM: r.distanceM,
      avgSpeedMps: r.avgSpeedMps,
      avgHr: r.avgHr,
      metersPerBeat,
      rolling: round4(median(recent)),
    });
  }
  return points;
}

export interface BestEffort {
  seconds: number;
  runId: number;
  startLocal: string;
}

/** Fastest time per distance among the given runs (null when no run covered it). */
export function bestEfforts(runs: Run[]): Record<BestDistance, BestEffort | null> {
  const result = Object.fromEntries(BEST_DISTANCES.map((d) => [d.id, null])) as Record<
    BestDistance,
    BestEffort | null
  >;
  for (const r of runs) {
    for (const { id } of BEST_DISTANCES) {
      const s = r.bestS[id];
      if (s && (!result[id] || s < result[id].seconds)) {
        result[id] = { seconds: s, runId: r.id, startLocal: r.startLocal };
      }
    }
  }
  return result;
}

export interface MonthBest {
  /** "YYYY-MM" */
  month: string;
  best: number;
  /** Fastest time up to and including this month. */
  record: number;
}

/** Best time per month (months without the distance are omitted) and the running record. */
export function monthlyBests(runs: Run[], distance: BestDistance): MonthBest[] {
  const byMonth = new Map<string, number>();
  for (const r of runs) {
    const s = r.bestS[distance];
    if (!s) continue;
    const month = r.startLocal.slice(0, 7);
    byMonth.set(month, Math.min(byMonth.get(month) ?? Infinity, s));
  }
  let record = Infinity;
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, best]) => {
      record = Math.min(record, best);
      return { month, best, record };
    });
}

/** Highest VDOT among the period's 5 km / 10 km / half-marathon best efforts. */
export function vdotFromRuns(
  runs: Run[],
): { value: number; distance: BestDistance; effort: BestEffort } | null {
  const bests = bestEfforts(runs);
  let top: { value: number; distance: BestDistance; effort: BestEffort } | null = null;
  for (const d of VDOT_DISTANCES) {
    const effort = bests[d];
    if (!effort) continue;
    const value = vdot(metersOf(d), effort.seconds);
    if (!top || value > top.value) top = { value, distance: d, effort };
  }
  return top;
}

/** First full-window rolling median vs the latest one (see paceTrend). */
export function efficiencyTrend(
  points: EfficiencyPoint[],
  window: number,
): { first: number; last: number } | null {
  if (points.length === 0) return null;
  return {
    first: points[Math.min(window, points.length) - 1]!.rolling,
    last: points.at(-1)!.rolling,
  };
}
