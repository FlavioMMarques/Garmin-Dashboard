import { Hono } from "hono";
import type { GarminClient } from "../garminClient.js";

// usersummary/daily (not v2/dailysummaries): its min/max HR are the raw values the app shows.
const DAILY_PATH = "/usersummary-service/usersummary/daily";
const CACHE_TTL_MS = 10 * 60_000;

/** Only the fields we read; ids and display name in the response are ignored. */
interface RawDaily {
  calendarDate?: string | null;
  includesWellnessData?: boolean | null;
  totalSteps?: number | null;
  dailyStepGoal?: number | null;
  totalDistanceMeters?: number | null;
  floorsAscended?: number | null;
  totalKilocalories?: number | null;
  activeKilocalories?: number | null;
  restingHeartRate?: number | null;
  lastSevenDaysAvgRestingHeartRate?: number | null;
  minHeartRate?: number | null;
  maxHeartRate?: number | null;
  averageStressLevel?: number | null;
  maxStressLevel?: number | null;
  stressQualifier?: string | null;
  bodyBatteryLowestValue?: number | null;
  bodyBatteryHighestValue?: number | null;
  bodyBatteryChargedValue?: number | null;
  bodyBatteryDrainedValue?: number | null;
  bodyBatteryAtWakeTime?: number | null;
  moderateIntensityMinutes?: number | null;
  vigorousIntensityMinutes?: number | null;
  intensityMinutesGoal?: number | null;
  averageSpo2?: number | null;
}

export interface DailySummary {
  date: string;
  /** False when the watch recorded nothing that day; every metric is then null. */
  hasData: boolean;
  steps: number | null;
  stepGoal: number | null;
  distanceMeters: number | null;
  floorsAscended: number | null;
  caloriesTotal: number | null;
  caloriesActive: number | null;
  restingHr: number | null;
  restingHr7dAvg: number | null;
  minHr: number | null;
  maxHr: number | null;
  stressAvg: number | null;
  stressMax: number | null;
  stressQualifier: string | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryCharged: number | null;
  bodyBatteryDrained: number | null;
  bodyBatteryAtWake: number | null;
  intensityModerate: number | null;
  intensityVigorous: number | null;
  intensityGoal: number | null;
  spo2Avg: number | null;
}

function toDaily(date: string, raw: RawDaily | null): DailySummary {
  const r = raw ?? {};
  return {
    date,
    hasData: Boolean(r.includesWellnessData),
    steps: r.totalSteps ?? null,
    stepGoal: r.dailyStepGoal ?? null,
    distanceMeters: r.totalDistanceMeters ?? null,
    floorsAscended: r.floorsAscended ?? null,
    caloriesTotal: r.totalKilocalories ?? null,
    caloriesActive: r.activeKilocalories ?? null,
    restingHr: r.restingHeartRate ?? null,
    restingHr7dAvg: r.lastSevenDaysAvgRestingHeartRate ?? null,
    minHr: r.minHeartRate ?? null,
    maxHr: r.maxHeartRate ?? null,
    stressAvg: r.averageStressLevel ?? null,
    stressMax: r.maxStressLevel ?? null,
    stressQualifier: r.stressQualifier ?? null,
    bodyBatteryMin: r.bodyBatteryLowestValue ?? null,
    bodyBatteryMax: r.bodyBatteryHighestValue ?? null,
    bodyBatteryCharged: r.bodyBatteryChargedValue ?? null,
    bodyBatteryDrained: r.bodyBatteryDrainedValue ?? null,
    bodyBatteryAtWake: r.bodyBatteryAtWakeTime ?? null,
    intensityModerate: r.moderateIntensityMinutes ?? null,
    intensityVigorous: r.vigorousIntensityMinutes ?? null,
    intensityGoal: r.intensityMinutesGoal ?? null,
    spo2Avg: r.averageSpo2 ?? null,
  };
}

export function dailyRoutes(
  garmin: GarminClient,
  { now = Date.now, onReset }: { now?: () => number; onReset?: (reset: () => void) => void } = {},
) {
  const cache = new Map<string, { expiresAt: number; day: Promise<DailySummary> }>();
  onReset?.(() => cache.clear());

  function cachedDay(date: string): Promise<DailySummary> {
    const hit = cache.get(date);
    if (hit && now() < hit.expiresAt) return hit.day;
    for (const [k, entry] of cache) if (now() >= entry.expiresAt) cache.delete(k);
    const day = garmin
      .get<RawDaily | null>(DAILY_PATH, { calendarDate: date })
      .then((raw) => toDaily(date, raw));
    cache.set(date, { expiresAt: now() + CACHE_TTL_MS, day });
    // Failures are not cached; only drop the entry if it is still this request's.
    day.catch(() => {
      if (cache.get(date)?.day === day) cache.delete(date);
    });
    return day;
  }

  return new Hono().get("/daily", async (c) => {
    const date = c.req.query("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "bad_request", message: "date deve ser YYYY-MM-DD" }, 400);
    }
    return c.json(await cachedDay(date));
  });
}
