import { median } from "./pace";
import { weeklyVolume, weekStart } from "./volume";

type Zones = [number, number, number, number, number];

interface Run {
  id: number;
  startLocal: string;
  distanceM: number | null;
  hrZonesS: Zones | null;
  trainingLabel: string | null;
  tempC: number | null;
  avgSpeedMps: number | null;
}

export interface WeekZones {
  weekStart: string;
  /** Seconds in HR zones 1–5. */
  zones: Zones;
  totalS: number;
}

/** HR-zone seconds per ISO week (same weeks as the volume chart; empty weeks are zero). */
export function weeklyZones(runs: Run[], from: string | undefined, to: string): WeekZones[] {
  const weeks = new Map<string, WeekZones>(
    weeklyVolume(runs, from, to).map((w) => [
      w.weekStart,
      { weekStart: w.weekStart, zones: [0, 0, 0, 0, 0], totalS: 0 },
    ]),
  );
  for (const r of runs) {
    const week = r.hrZonesS && weeks.get(weekStart(r.startLocal));
    if (!week) continue;
    r.hrZonesS!.forEach((s, i) => {
      week.zones[i]! += s;
      week.totalS += s;
    });
  }
  return [...weeks.values()];
}

/** Share of HR time that was easy (Z1–2), moderate (Z3) and hard (Z4–5). */
export function zoneShare(runs: Run[]): { easy: number; moderate: number; hard: number } | null {
  const z: Zones = [0, 0, 0, 0, 0];
  for (const r of runs) r.hrZonesS?.forEach((s, i) => (z[i]! += s));
  const total = z.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return { easy: (z[0] + z[1]) / total, moderate: z[2] / total, hard: (z[3] + z[4]) / total };
}

export interface MetricPoint {
  id: number;
  startLocal: string;
  value: number;
  /** Median of the last `window` values. */
  rolling: number;
}

/** Any per-run metric as points with a rolling median (runs without the value are skipped). */
export function metricSeries<R extends { id: number; startLocal: string }>(
  runs: R[],
  pick: (r: R) => number | null,
  window = 5,
): MetricPoint[] {
  const recent: number[] = [];
  const points: MetricPoint[] = [];
  for (const r of runs) {
    const value = pick(r);
    if (value == null) continue;
    recent.push(value);
    if (recent.length > window) recent.shift();
    points.push({ id: r.id, startLocal: r.startLocal, value, rolling: median(recent) });
  }
  return points;
}

const LABEL_NAMES: Record<string, string> = {
  RECOVERY: "Recuperação",
  AEROBIC_BASE: "Base aeróbica",
  TEMPO: "Tempo",
  LACTATE_THRESHOLD: "Limiar de lactato",
  VO2MAX: "VO2 máx.",
  ANAEROBIC_CAPACITY: "Capacidade anaeróbica",
  SPEED: "Velocidade",
};

export function trainingLabelName(label: string): string {
  return LABEL_NAMES[label] ?? label.toLowerCase().replaceAll("_", " ");
}

/** Garmin's training-effect label per run, counted, most frequent first. */
export function labelCounts(runs: Run[]): { label: string; name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of runs) {
    if (r.trainingLabel) counts.set(r.trainingLabel, (counts.get(r.trainingLabel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, name: trainingLabelName(label), count }))
    .sort((a, b) => b.count - a.count);
}

export interface HeatBin {
  fromC: number;
  toC: number;
  count: number;
  medianSecPerKm: number;
}

/** Median pace per temperature band of `binC` degrees (bands without runs are omitted). */
export function heatBins(runs: Run[], binC = 2): HeatBin[] {
  const bins = new Map<number, number[]>();
  for (const r of runs) {
    if (r.tempC == null || !r.avgSpeedMps) continue;
    const from = Math.floor(r.tempC / binC) * binC;
    bins.set(from, [...(bins.get(from) ?? []), 1000 / r.avgSpeedMps]);
  }
  return [...bins.entries()]
    .sort(([a], [b]) => a - b)
    .map(([fromC, paces]) => ({
      fromC,
      toC: fromC + binC,
      count: paces.length,
      medianSecPerKm: Math.round(median(paces) * 10) / 10,
    }));
}
