export type DistanceBucket = "short" | "medium" | "long";

export const BUCKETS: { id: DistanceBucket; label: string }[] = [
  { id: "short", label: "Até 8 km" },
  { id: "medium", label: "8–15 km" },
  { id: "long", label: "Mais de 15 km" },
];

export function distanceBucket(meters: number): DistanceBucket {
  if (meters < 8000) return "short";
  return meters <= 15000 ? "medium" : "long";
}

interface Run {
  id: number;
  startLocal: string;
  distanceM: number | null;
  avgSpeedMps: number | null;
}

export interface PacePoint {
  id: number;
  startLocal: string;
  distanceM: number;
  bucket: DistanceBucket;
  secPerKm: number;
  /** Median pace of the last `window` runs in the same bucket, this one included. */
  rollingSecPerKm: number;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Linear-interpolated quantile of a sorted array. */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  return sorted[lo]! + (sorted[Math.ceil(pos)]! - sorted[lo]!) * (pos - lo);
}

/**
 * Pace per run (oldest first) with a trailing median per distance bucket —
 * a median so one walk-like run doesn't drag the trend for `window` runs.
 */
export function paceSeries(runs: Run[], window = 5): PacePoint[] {
  const recent: Record<DistanceBucket, number[]> = { short: [], medium: [], long: [] };
  const points: PacePoint[] = [];
  for (const r of runs) {
    if (!r.distanceM || !r.avgSpeedMps) continue;
    const bucket = distanceBucket(r.distanceM);
    const secPerKm = 1000 / r.avgSpeedMps;
    const last = recent[bucket];
    last.push(secPerKm);
    if (last.length > window) last.shift();
    points.push({
      id: r.id,
      startLocal: r.startLocal,
      distanceM: r.distanceM,
      bucket,
      secPerKm,
      rollingSecPerKm: median(last),
    });
  }
  return points;
}

export interface PaceTrend {
  bucket: DistanceBucket;
  count: number;
  /** Rolling pace at the first full window (or the last run if there are fewer) and at the end. */
  firstSecPerKm: number;
  lastSecPerKm: number;
}

/**
 * Start vs end of the rolling median, per bucket with runs (BUCKETS order). The start is
 * the first point whose window is full, so a single early run can't set the baseline.
 */
export function paceTrend(points: PacePoint[], window: number): PaceTrend[] {
  return BUCKETS.flatMap(({ id }) => {
    const inBucket = points.filter((p) => p.bucket === id);
    if (inBucket.length === 0) return [];
    return [
      {
        bucket: id,
        count: inBucket.length,
        firstSecPerKm: inBucket[Math.min(window, inBucket.length) - 1]!.rollingSecPerKm,
        lastSecPerKm: inBucket.at(-1)!.rollingSecPerKm,
      },
    ];
  });
}

const DOMAIN_PAD_S = 10;
const DOMAIN_STEP_S = 15;

/**
 * Y range (s/km) framing the 5th–95th percentile of runs plus every trend value,
 * in 15 s steps; `outside` counts runs drawn off-scale (they stay in the table).
 */
export function paceDomain(points: PacePoint[]): { domain: [number, number]; outside: number } {
  return robustPaceRange(
    points.map((p) => p.secPerKm),
    points.map((p) => p.rollingSecPerKm),
  );
}

/** Same framing for any set of paces; `keep` values (e.g. a trend) are always inside. */
export function robustPaceRange(
  paces: number[],
  keep: number[] = [],
): { domain: [number, number]; outside: number } {
  if (paces.length === 0) return { domain: [240, 420], outside: 0 };
  const sorted = [...paces].sort((a, b) => a - b);
  const lo = Math.min(quantile(sorted, 0.05), ...keep) - DOMAIN_PAD_S;
  const hi = Math.max(quantile(sorted, 0.95), ...keep) + DOMAIN_PAD_S;
  const domain: [number, number] = [
    Math.floor(lo / DOMAIN_STEP_S) * DOMAIN_STEP_S,
    Math.ceil(hi / DOMAIN_STEP_S) * DOMAIN_STEP_S,
  ];
  const outside = sorted.filter((p) => p < domain[0] || p > domain[1]).length;
  return { domain, outside };
}
