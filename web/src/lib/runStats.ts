import type { RunSummary } from "../api/runs";

export type Period = "3m" | "6m" | "1y" | "all";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "1y", label: "1 ano" },
  { id: "all", label: "Tudo" },
];

const MONTHS: Record<Exclude<Period, "all">, number> = { "3m": 3, "6m": 6, "1y": 12 };

const pad2 = (n: number) => n.toString().padStart(2, "0");

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Same day `months` earlier, clamped to the last day of the target month. */
function minusMonths(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

function nextDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/**
 * Window ending today (inclusive) and the equally long window right before it.
 * Both are local YYYY-MM-DD start dates; "all" has no bounds.
 */
export function periodRange(period: Period, today: Date): { from?: string; prevFrom?: string } {
  if (period === "all") return {};
  const n = MONTHS[period];
  return {
    from: toIsoDate(nextDay(minusMonths(today, n))),
    prevFrom: toIsoDate(nextDay(minusMonths(today, 2 * n))),
  };
}

/** Runs starting before `date` go to `previous`, the rest to `current`. */
export function splitAt(runs: RunSummary[], date: string | undefined) {
  if (!date) return { current: runs, previous: [] as RunSummary[] };
  const current: RunSummary[] = [];
  const previous: RunSummary[] = [];
  for (const r of runs) (r.startLocal.slice(0, 10) >= date ? current : previous).push(r);
  return { current, previous };
}

export interface RunTotals {
  count: number;
  distanceM: number;
  movingS: number;
  /** Total distance ÷ total moving time; null when there is no timed distance. */
  avgSpeedMps: number | null;
  longestM: number;
}

export function summarize(runs: RunSummary[]): RunTotals {
  let distanceM = 0;
  let movingS = 0;
  let timedDistance = 0;
  let longestM = 0;
  for (const r of runs) {
    const d = r.distanceM ?? 0;
    distanceM += d;
    longestM = Math.max(longestM, d);
    if (r.movingS) {
      movingS += r.movingS;
      timedDistance += d;
    }
  }
  return {
    count: runs.length,
    distanceM,
    movingS,
    avgSpeedMps: movingS > 0 && timedDistance > 0 ? timedDistance / movingS : null,
    longestM,
  };
}
