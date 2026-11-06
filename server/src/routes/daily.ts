import { Hono } from "hono";
import type { GarminClient } from "../garminClient.js";
import { daysInRange, eachDay, splitRange } from "../dateRanges.js";
import { createTtlCache } from "../ttlCache.js";

// usersummary/daily (not v2/dailysummaries): its min/max HR are the raw values the app shows.
const DAILY_PATH = "/usersummary-service/usersummary/daily";
// v2 takes a range; measured on the real API: 366 days per call OK, 367 → 400.
const RANGE_PATH = "/usersummary-service/v2/dailysummaries";
const RANGE_BLOCK_DAYS = 366;
const RANGE_MAX_DAYS = 400;
const CACHE_TTL_MS = 10 * 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Only the v2 fields we read; ids and device data are ignored. */
interface RawDayV2 {
  calendarDate?: string | null;
  includesWellnessData?: boolean | null;
  movement?: { steps?: { value?: number | null; goal?: number | null } | null } | null;
  heartRate?: { restingValue?: number | null } | null;
  stress?: { avgLevel?: number | null; highStressProportion?: number | null } | null;
  bodyBattery?: {
    minValue?: number | null;
    maxValue?: number | null;
    chargedValue?: number | null;
    drainedValue?: number | null;
  } | null;
  intensityMinutes?: {
    moderate?: number | null;
    vigorous?: number | null;
    goal?: number | null;
  } | null;
  calories?: { burnedActive?: number | null } | null;
}

/** One day of history, for insights and trends. */
export interface DayPoint {
  date: string;
  hasData: boolean;
  steps: number | null;
  stepGoal: number | null;
  restingHr: number | null;
  stressAvg: number | null;
  /** Share (0–1) of the day spent in high stress. */
  stressHighShare: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryCharged: number | null;
  bodyBatteryDrained: number | null;
  intensityModerate: number | null;
  intensityVigorous: number | null;
  intensityGoal: number | null;
  caloriesActive: number | null;
}

function toDayPoint(date: string, raw: RawDayV2 | undefined): DayPoint {
  const r = raw ?? {};
  return {
    date,
    hasData: Boolean(r.includesWellnessData),
    steps: r.movement?.steps?.value ?? null,
    stepGoal: r.movement?.steps?.goal ?? null,
    restingHr: r.heartRate?.restingValue ?? null,
    stressAvg: r.stress?.avgLevel ?? null,
    stressHighShare: r.stress?.highStressProportion ?? null,
    bodyBatteryMin: r.bodyBattery?.minValue ?? null,
    bodyBatteryMax: r.bodyBattery?.maxValue ?? null,
    bodyBatteryCharged: r.bodyBattery?.chargedValue ?? null,
    bodyBatteryDrained: r.bodyBattery?.drainedValue ?? null,
    intensityModerate: r.intensityMinutes?.moderate ?? null,
    intensityVigorous: r.intensityMinutes?.vigorous ?? null,
    intensityGoal: r.intensityMinutes?.goal ?? null,
    caloriesActive: r.calories?.burnedActive ?? null,
  };
}

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
  const { get: cached, clear } = createTtlCache(CACHE_TTL_MS, now);
  onReset?.(clear);

  async function loadRange(from: string, to: string): Promise<DayPoint[]> {
    const responses = await Promise.all(
      splitRange(from, to, RANGE_BLOCK_DAYS).map(({ start, end }) =>
        garmin.get<{ data?: RawDayV2[] | null } | null>(RANGE_PATH, {
          startDate: start,
          endDate: end,
        }),
      ),
    );
    const byDate = new Map<string, RawDayV2>();
    for (const res of responses) {
      for (const d of res?.data ?? []) if (d.calendarDate) byDate.set(d.calendarDate, d);
    }
    // Garmin omits days without data; keep the series continuous.
    return eachDay(from, to).map((date) => toDayPoint(date, byDate.get(date)));
  }

  return new Hono()
    .get("/daily", async (c) => {
      const date = c.req.query("date");
      if (!date || !DATE_RE.test(date)) {
        return c.json({ error: "bad_request", message: "date deve ser YYYY-MM-DD" }, 400);
      }
      const day = cached(`day:${date}`, () =>
        garmin
          .get<RawDaily | null>(DAILY_PATH, { calendarDate: date })
          .then((raw) => toDaily(date, raw)),
      );
      return c.json(await day);
    })
    .get("/daily/range", async (c) => {
      const from = c.req.query("from");
      const to = c.req.query("to");
      if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
        return c.json({ error: "bad_request", message: "from e to devem ser YYYY-MM-DD" }, 400);
      }
      const length = daysInRange(from, to);
      if (length < 1 || length > RANGE_MAX_DAYS) {
        return c.json(
          { error: "bad_request", message: `intervalo deve ter de 1 a ${RANGE_MAX_DAYS} dias` },
          400,
        );
      }
      const days = await cached(`range:${from}:${to}`, () => loadRange(from, to));
      return c.json({ days });
    });
}
