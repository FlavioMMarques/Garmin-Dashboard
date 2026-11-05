import type { RunSummary } from "../api/runs";

export const NO_BESTS: RunSummary["bestS"] = {
  "1000": null,
  "1609": null,
  "5000": null,
  "10000": null,
  "21098": null,
};

/** A plain 6 km run at 5:50 /km on `day` at `time`, overridable per field. */
export function mkRun(
  id: number,
  day: string,
  o: Partial<RunSummary> = {},
  time = "07:00:00",
): RunSummary {
  return {
    id,
    startLocal: `${day} ${time}`,
    type: "running",
    distanceM: 6000,
    durationS: 2100,
    movingS: 2100,
    avgSpeedMps: 1000 / 350,
    avgHr: 155,
    maxHr: null,
    cadenceSpm: null,
    strideCm: null,
    verticalOscCm: null,
    groundContactMs: null,
    verticalRatio: null,
    powerW: null,
    elevationGainM: null,
    tempC: null,
    aerobicTe: null,
    anaerobicTe: null,
    trainingLabel: null,
    bestS: NO_BESTS,
    hrZonesS: null,
    ...o,
  };
}

/** `n` runs every `everyDays` days from `start` (fractional steps are truncated per run). */
export function runSeries(
  n: number,
  start: string,
  everyDays: number,
  f: (i: number) => Partial<RunSummary> = () => ({}),
  time?: (i: number) => string,
): RunSummary[] {
  const [y, m, d] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(y!, m! - 1, d! + Math.trunc(i * everyDays));
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return mkRun(i + 1, iso, f(i), time?.(i));
  });
}
