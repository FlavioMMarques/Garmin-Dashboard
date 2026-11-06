import { Hono } from "hono";
import type { GarminClient } from "../garminClient.js";
import { daysInRange, eachDay, splitRange } from "../dateRanges.js";
import { createTtlCache } from "../ttlCache.js";

const SLEEP_PATH = "/sleep-service/sleep/dailySleepSummariesByDate";
const HRV_PATH = "/hrv-service/hrv/daily";
// Measured on the real API: 31 nights per call work, 91 are rejected.
const BLOCK_DAYS = 31;
const MAX_DAYS = 400;
const CACHE_TTL_MS = 10 * 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Only the fields we read; ids and device data are ignored. */
interface RawNight {
  calendarDate?: string | null;
  sleepTimeSeconds?: number | null;
  deepSleepSeconds?: number | null;
  lightSleepSeconds?: number | null;
  remSleepSeconds?: number | null;
  awakeSleepSeconds?: number | null;
  napTimeSeconds?: number | null;
  /** Epoch ms shifted to the user's wall clock. */
  sleepStartTimestampLocal?: number | null;
  sleepEndTimestampLocal?: number | null;
  awakeCount?: number | null;
  avgSleepStress?: number | null;
  avgHeartRate?: number | null;
  averageRespirationValue?: number | null;
  averageSpO2Value?: number | null;
  sleepScores?: { overall?: { value?: number | null; qualifierKey?: string | null } | null } | null;
  sleepNeed?: { actual?: number | null } | null;
}

interface RawHrv {
  calendarDate?: string | null;
  lastNightAvg?: number | null;
  weeklyAvg?: number | null;
  status?: string | null;
  baseline?: { balancedLow?: number | null; balancedUpper?: number | null } | null;
}

export interface Night {
  /** Garmin's calendar date for the night: the day you woke up. */
  date: string;
  hasData: boolean;
  sleepSeconds: number | null;
  deepSeconds: number | null;
  lightSeconds: number | null;
  remSeconds: number | null;
  awakeSeconds: number | null;
  napSeconds: number | null;
  /** Local wall-clock time, "YYYY-MM-DDTHH:MM". */
  startLocal: string | null;
  endLocal: string | null;
  score: number | null;
  scoreQualifier: string | null;
  awakeCount: number | null;
  avgSleepStress: number | null;
  avgHr: number | null;
  avgRespiration: number | null;
  avgSpO2: number | null;
  /** Garmin's sleep need for the night, in minutes. */
  sleepNeedMinutes: number | null;
  hrvLastNight: number | null;
  hrvWeeklyAvg: number | null;
  hrvStatus: string | null;
  hrvBalancedLow: number | null;
  hrvBalancedUpper: number | null;
}

const wallClock = (ms: number | null | undefined) =>
  ms == null ? null : new Date(ms).toISOString().slice(0, 16);

function toNight(date: string, n: RawNight | undefined, h: RawHrv | undefined): Night {
  return {
    date,
    hasData: n?.sleepTimeSeconds != null,
    sleepSeconds: n?.sleepTimeSeconds ?? null,
    deepSeconds: n?.deepSleepSeconds ?? null,
    lightSeconds: n?.lightSleepSeconds ?? null,
    remSeconds: n?.remSleepSeconds ?? null,
    awakeSeconds: n?.awakeSleepSeconds ?? null,
    napSeconds: n?.napTimeSeconds ?? null,
    startLocal: wallClock(n?.sleepStartTimestampLocal),
    endLocal: wallClock(n?.sleepEndTimestampLocal),
    score: n?.sleepScores?.overall?.value ?? null,
    scoreQualifier: n?.sleepScores?.overall?.qualifierKey ?? null,
    awakeCount: n?.awakeCount ?? null,
    avgSleepStress: n?.avgSleepStress ?? null,
    avgHr: n?.avgHeartRate ?? null,
    avgRespiration: n?.averageRespirationValue ?? null,
    avgSpO2: n?.averageSpO2Value ?? null,
    sleepNeedMinutes: n?.sleepNeed?.actual ?? null,
    hrvLastNight: h?.lastNightAvg ?? null,
    hrvWeeklyAvg: h?.weeklyAvg ?? null,
    hrvStatus: h?.status ?? null,
    hrvBalancedLow: h?.baseline?.balancedLow ?? null,
    hrvBalancedUpper: h?.baseline?.balancedUpper ?? null,
  };
}

/** Indexes by calendar date, skipping Garmin's all-null placeholder entries. */
function byDate<T extends { calendarDate?: string | null }>(lists: (T[] | null | undefined)[]) {
  const map = new Map<string, T>();
  for (const list of lists)
    for (const item of list ?? []) {
      if (item.calendarDate) map.set(item.calendarDate, item);
    }
  return map;
}

export function sleepRoutes(
  garmin: GarminClient,
  { now = Date.now, onReset }: { now?: () => number; onReset?: (reset: () => void) => void } = {},
) {
  const cache = createTtlCache(CACHE_TTL_MS, now);
  onReset?.(cache.clear);

  async function load(from: string, to: string): Promise<Night[]> {
    const blocks = splitRange(from, to, BLOCK_DAYS);
    const [sleep, hrv] = await Promise.all([
      Promise.all(
        blocks.map(({ start, end }) =>
          garmin.get<RawNight[] | null>(SLEEP_PATH, { startDate: start, endDate: end }),
        ),
      ),
      Promise.all(
        blocks.map(({ start, end }) =>
          garmin.get<{ hrvSummaries?: RawHrv[] | null } | null>(`${HRV_PATH}/${start}/${end}`),
        ),
      ),
    ]);
    const nights = byDate(sleep);
    const hrvByDate = byDate(hrv.map((r) => r?.hrvSummaries));
    return eachDay(from, to).map((d) => toNight(d, nights.get(d), hrvByDate.get(d)));
  }

  return new Hono().get("/sleep", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      return c.json({ error: "bad_request", message: "from e to devem ser YYYY-MM-DD" }, 400);
    }
    const length = daysInRange(from, to);
    if (length < 1 || length > MAX_DAYS) {
      return c.json(
        { error: "bad_request", message: `intervalo deve ter de 1 a ${MAX_DAYS} dias` },
        400,
      );
    }
    return c.json({ nights: await cache.get(`${from}:${to}`, () => load(from, to)) });
  });
}
