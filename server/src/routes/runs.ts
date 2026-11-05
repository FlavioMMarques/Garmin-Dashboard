import { Hono } from "hono";
import type { GarminClient } from "../garminClient.js";

const SEARCH_PATH = "/activitylist-service/activities/search/activities";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const CACHE_TTL_MS = 10 * 60_000;

export const BEST_DISTANCES = ["1000", "1609", "5000", "10000", "21098"] as const;
export type BestDistance = (typeof BEST_DISTANCES)[number];

/** Only the Garmin fields we read; owner, GPS and the rest are dropped. */
export interface RawRun {
  activityId: number;
  startTimeLocal: string;
  activityType?: { typeKey?: string } | null;
  distance?: number | null;
  duration?: number | null;
  movingDuration?: number | null;
  averageSpeed?: number | null;
  averageHR?: number | null;
  maxHR?: number | null;
  averageRunningCadenceInStepsPerMinute?: number | null;
  avgStrideLength?: number | null;
  avgVerticalOscillation?: number | null;
  avgGroundContactTime?: number | null;
  avgVerticalRatio?: number | null;
  avgPower?: number | null;
  elevationGain?: number | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  aerobicTrainingEffect?: number | null;
  anaerobicTrainingEffect?: number | null;
  trainingEffectLabel?: string | null;
  [key: `fastestSplit_${string}` | `hrTimeInZone_${number}`]: number | null | undefined;
}

export interface RunSummary {
  id: number;
  /** "YYYY-MM-DD HH:mm:ss" local time. */
  startLocal: string;
  type: string;
  distanceM: number | null;
  durationS: number | null;
  movingS: number | null;
  avgSpeedMps: number | null;
  avgHr: number | null;
  maxHr: number | null;
  cadenceSpm: number | null;
  strideCm: number | null;
  verticalOscCm: number | null;
  groundContactMs: number | null;
  verticalRatio: number | null;
  powerW: number | null;
  elevationGainM: number | null;
  /** Midpoint of the min/max temperature recorded by the watch. */
  tempC: number | null;
  aerobicTe: number | null;
  anaerobicTe: number | null;
  trainingLabel: string | null;
  /** Fastest time (s) over each distance within this run. */
  bestS: Record<BestDistance, number | null>;
  /** Seconds in HR zones 1–5; null when the run has no HR zone data. */
  hrZonesS: [number, number, number, number, number] | null;
}

export function mapRun(raw: RawRun): RunSummary {
  const zones = [1, 2, 3, 4, 5].map((z) => raw[`hrTimeInZone_${z}`] ?? null);
  const hasZones = zones.some((s) => s != null);
  const { minTemperature: tMin, maxTemperature: tMax } = raw;
  return {
    id: raw.activityId,
    startLocal: raw.startTimeLocal,
    type: raw.activityType?.typeKey ?? "running",
    distanceM: raw.distance ?? null,
    durationS: raw.duration ?? null,
    movingS: raw.movingDuration ?? raw.duration ?? null,
    avgSpeedMps: raw.averageSpeed ?? null,
    avgHr: raw.averageHR ?? null,
    maxHr: raw.maxHR ?? null,
    cadenceSpm: raw.averageRunningCadenceInStepsPerMinute ?? null,
    strideCm: raw.avgStrideLength ?? null,
    verticalOscCm: raw.avgVerticalOscillation ?? null,
    groundContactMs: raw.avgGroundContactTime ?? null,
    verticalRatio: raw.avgVerticalRatio ?? null,
    powerW: raw.avgPower ?? null,
    elevationGainM: raw.elevationGain ?? null,
    tempC: tMin != null && tMax != null ? (tMin + tMax) / 2 : null,
    aerobicTe: raw.aerobicTrainingEffect ?? null,
    anaerobicTe: raw.anaerobicTrainingEffect ?? null,
    trainingLabel: raw.trainingEffectLabel ?? null,
    bestS: Object.fromEntries(
      BEST_DISTANCES.map((d) => [d, raw[`fastestSplit_${d}`] ?? null]),
    ) as RunSummary["bestS"],
    hrZonesS: hasZones ? (zones.map((s) => s ?? 0) as RunSummary["hrZonesS"]) : null,
  };
}

export interface RunsOptions {
  now?: () => number;
  /** Registers a callback that clears this route's cache. */
  onReset?: (reset: () => void) => void;
}

export function runsRoutes(garmin: GarminClient, { now = Date.now, onReset }: RunsOptions = {}) {
  const cache = new Map<string, { expiresAt: number; runs: Promise<RunSummary[]> }>();
  onReset?.(() => cache.clear());

  async function fetchRuns(from: string | undefined): Promise<RunSummary[]> {
    const raw: RawRun[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch =
        (await garmin.get<RawRun[] | null>(SEARCH_PATH, {
          activityType: "running",
          ...(from ? { startDate: from } : {}),
          start: page * PAGE_SIZE,
          limit: PAGE_SIZE,
        })) ?? [];
      raw.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return raw.map(mapRun).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
  }

  function cachedRuns(from: string | undefined): Promise<RunSummary[]> {
    const key = from ?? "all";
    const hit = cache.get(key);
    if (hit && now() < hit.expiresAt) return hit.runs;
    for (const [k, entry] of cache) if (now() >= entry.expiresAt) cache.delete(k);
    const runs = fetchRuns(from);
    cache.set(key, { expiresAt: now() + CACHE_TTL_MS, runs });
    // Failures are not cached; only drop the entry if it is still this request's.
    runs.catch(() => {
      if (cache.get(key)?.runs === runs) cache.delete(key);
    });
    return runs;
  }

  return new Hono().get("/runs", async (c) => {
    const from = c.req.query("from");
    if (from !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return c.json({ error: "bad_request", message: "from deve ser YYYY-MM-DD" }, 400);
    }
    return c.json({ runs: await cachedRuns(from) });
  });
}
