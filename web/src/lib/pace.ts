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
  /** Mean pace of the last `window` runs in the same bucket, this one included. */
  rollingSecPerKm: number;
}

/** Pace per run (oldest first) with a trailing average per distance bucket. */
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
      rollingSecPerKm: last.reduce((a, b) => a + b, 0) / last.length,
    });
  }
  return points;
}
