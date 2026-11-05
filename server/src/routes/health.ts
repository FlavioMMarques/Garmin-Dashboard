import { Hono } from "hono";
import { daysInRange, spanDays, splitRange } from "../dateRanges.js";
import type { GarminClient } from "../garminClient.js";

const SUMMARIES_PATH = "/usersummary-service/v2/dailysummaries";
const SLEEP_PATH = "/sleep-service/sleep/dailySleepSummariesByDate";
const HRV_PATH = "/hrv-service/hrv/daily";
/** Garmin's per-call limits: summaries 1 year, sleep 31 days; HRV accepted 64, we use 60. */
const SUMMARY_BLOCK = 365;
const SLEEP_BLOCK = 31;
const HRV_BLOCK = 60;
const MAX_SPAN_DAYS = 400;
const CACHE_TTL_MS = 10 * 60_000;

type N = number | null | undefined;

interface RawSummary {
  calendarDate: string;
  movement?: { steps?: { goal?: N; value?: N }; floorsAscended?: { value?: N } };
  calories?: { burnedTotal?: N; burnedActive?: N };
  heartRate?: { minValue?: N; maxValue?: N; restingValue?: N };
  intensityMinutes?: { goal?: N; moderate?: N; vigorous?: N };
  stress?: { avgLevel?: N; maxLevel?: N };
  bodyBattery?: { minValue?: N; maxValue?: N; chargedValue?: N; drainedValue?: N };
  respiration?: { avgValue?: N };
}

interface RawSleep {
  calendarDate: string;
  sleepTimeSeconds?: N;
  deepSleepSeconds?: N;
  lightSleepSeconds?: N;
  remSleepSeconds?: N;
  awakeSleepSeconds?: N;
  /** Local wall-clock time encoded as epoch milliseconds. */
  sleepStartTimestampLocal?: N;
  sleepEndTimestampLocal?: N;
  avgHeartRate?: N;
  avgSleepStress?: N;
  sleepScores?: { overall?: { value?: N; qualifierKey?: string | null } | null } | null;
}

interface RawHrv {
  calendarDate: string;
  lastNightAvg?: N;
  weeklyAvg?: N;
  status?: string | null;
}

export interface SleepNight {
  totalS: number | null;
  deepS: number | null;
  lightS: number | null;
  remS: number | null;
  awakeS: number | null;
  score: number | null;
  scoreQualifier: string | null;
  /** "YYYY-MM-DDTHH:mm" local time. */
  startLocal: string | null;
  endLocal: string | null;
  avgHr: number | null;
  avgStress: number | null;
}

export interface HealthDay {
  date: string;
  steps: number | null;
  stepsGoal: number | null;
  floors: number | null;
  restingHr: number | null;
  minHr: number | null;
  maxHr: number | null;
  stressAvg: number | null;
  stressMax: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryCharged: number | null;
  bodyBatteryDrained: number | null;
  intensityModerate: number | null;
  intensityVigorous: number | null;
  intensityGoal: number | null;
  caloriesTotal: number | null;
  caloriesActive: number | null;
  respirationAvg: number | null;
  /** The night that ended on this date (Garmin's calendarDate is the wake-up day). */
  sleep: SleepNight | null;
  hrv: { lastNightAvg: number | null; weeklyAvg: number | null; status: string | null } | null;
}

const n = (v: N) => (typeof v === "number" ? v : null);
const localTime = (ms: N) =>
  typeof ms === "number" ? new Date(ms).toISOString().slice(0, 16) : null;

function mapSleep(s: RawSleep): SleepNight {
  return {
    totalS: n(s.sleepTimeSeconds),
    deepS: n(s.deepSleepSeconds),
    lightS: n(s.lightSleepSeconds),
    remS: n(s.remSleepSeconds),
    awakeS: n(s.awakeSleepSeconds),
    score: n(s.sleepScores?.overall?.value),
    scoreQualifier: s.sleepScores?.overall?.qualifierKey ?? null,
    startLocal: localTime(s.sleepStartTimestampLocal),
    endLocal: localTime(s.sleepEndTimestampLocal),
    avgHr: n(s.avgHeartRate),
    avgStress: n(s.avgSleepStress),
  };
}

export function mapHealthDay(
  date: string,
  sum: RawSummary | undefined,
  sleep: RawSleep | undefined,
  hrv: RawHrv | undefined,
): HealthDay {
  return {
    date,
    steps: n(sum?.movement?.steps?.value),
    stepsGoal: n(sum?.movement?.steps?.goal),
    floors: n(sum?.movement?.floorsAscended?.value),
    restingHr: n(sum?.heartRate?.restingValue),
    minHr: n(sum?.heartRate?.minValue),
    maxHr: n(sum?.heartRate?.maxValue),
    stressAvg: n(sum?.stress?.avgLevel),
    stressMax: n(sum?.stress?.maxLevel),
    bodyBatteryMin: n(sum?.bodyBattery?.minValue),
    bodyBatteryMax: n(sum?.bodyBattery?.maxValue),
    bodyBatteryCharged: n(sum?.bodyBattery?.chargedValue),
    bodyBatteryDrained: n(sum?.bodyBattery?.drainedValue),
    intensityModerate: n(sum?.intensityMinutes?.moderate),
    intensityVigorous: n(sum?.intensityMinutes?.vigorous),
    intensityGoal: n(sum?.intensityMinutes?.goal),
    caloriesTotal: n(sum?.calories?.burnedTotal),
    caloriesActive: n(sum?.calories?.burnedActive),
    respirationAvg: n(sum?.respiration?.avgValue),
    sleep: sleep && sleep.sleepTimeSeconds ? mapSleep(sleep) : null,
    hrv: hrv
      ? {
          lastNightAvg: n(hrv.lastNightAvg),
          weeklyAvg: n(hrv.weeklyAvg),
          status: hrv.status ?? null,
        }
      : null,
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function healthRoutes(
  garmin: GarminClient,
  { now = Date.now, onReset }: { now?: () => number; onReset?: (reset: () => void) => void } = {},
) {
  const cache = new Map<string, { expiresAt: number; days: Promise<HealthDay[]> }>();
  onReset?.(() => cache.clear());

  async function fetchDays(from: string, to: string): Promise<HealthDay[]> {
    const inBlocks = <T>(size: number, call: (b: { from: string; to: string }) => Promise<T[]>) =>
      Promise.all(splitRange(from, to, size).map(call)).then((parts) => parts.flat());
    const [summaries, sleeps, hrvs] = await Promise.all([
      inBlocks(
        SUMMARY_BLOCK,
        async (b) =>
          (
            await garmin.get<{ data?: RawSummary[] } | null>(SUMMARIES_PATH, {
              startDate: b.from,
              endDate: b.to,
            })
          )?.data ?? [],
      ),
      inBlocks(
        SLEEP_BLOCK,
        async (b) =>
          (await garmin.get<RawSleep[] | null>(SLEEP_PATH, { startDate: b.from, endDate: b.to })) ??
          [],
      ),
      inBlocks(
        HRV_BLOCK,
        async (b) =>
          (await garmin.get<{ hrvSummaries?: RawHrv[] } | null>(`${HRV_PATH}/${b.from}/${b.to}`))
            ?.hrvSummaries ?? [],
      ),
    ]);
    const byDate = <T extends { calendarDate: string }>(xs: T[]) =>
      new Map(xs.map((x) => [x.calendarDate, x]));
    const sum = byDate(summaries);
    const slp = byDate(sleeps);
    const hrv = byDate(hrvs);
    return daysInRange(from, to).map((d) => mapHealthDay(d, sum.get(d), slp.get(d), hrv.get(d)));
  }

  return new Hono().get("/wellness", async (c) => {
    const from = c.req.query("from") ?? "";
    const to = c.req.query("to") ?? "";
    if (!DAY.test(from) || !DAY.test(to) || from > to || spanDays(from, to) > MAX_SPAN_DAYS) {
      return c.json(
        {
          error: "bad_request",
          message: `from e to (YYYY-MM-DD), from ≤ to, até ${MAX_SPAN_DAYS} dias`,
        },
        400,
      );
    }
    const key = `${from}|${to}`;
    const hit = cache.get(key);
    if (!hit || now() >= hit.expiresAt) {
      for (const [k, entry] of cache) if (now() >= entry.expiresAt) cache.delete(k);
      const days = fetchDays(from, to);
      cache.set(key, { expiresAt: now() + CACHE_TTL_MS, days });
      days.catch(() => {
        if (cache.get(key)?.days === days) cache.delete(key);
      });
    }
    return c.json({ days: await cache.get(key)!.days });
  });
}
