import type { Night } from "../api/sleep";

const DAY_MIN = 24 * 60;
const NOON = 12 * 60;

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** "YYYY-MM-DDTHH:MM" → minutes after midnight. */
const clockMinutes = (local: string) =>
  Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));

/**
 * Average time of day, in minutes after midnight. Times are measured from noon so a
 * bedtime of 23:30 and one of 00:30 average to 00:00, not 12:00.
 */
export function averageClock(locals: string[]): number | null {
  const fromNoon = mean(locals.map((l) => (clockMinutes(l) - NOON + DAY_MIN) % DAY_MIN));
  return fromNoon == null ? null : Math.round(fromNoon + NOON) % DAY_MIN;
}

export function formatClock(minutes: number): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export interface SleepSummary {
  nights: number;
  avgSleepSeconds: number | null;
  avgScore: number | null;
  avgHrv: number | null;
  avgNeedMinutes: number | null;
  /** Minutes after midnight. */
  avgBedtime: number | null;
  avgWake: number | null;
}

/** Averages over the nights that have data. */
export function summarizeNights(nights: Night[]): SleepSummary {
  const withData = nights.filter((n) => n.hasData);
  const avg = (pick: (n: Night) => number | null) =>
    mean(withData.map(pick).filter((v): v is number => v != null));
  const times = (pick: (n: Night) => string | null) =>
    withData.map(pick).filter((v): v is string => v != null);
  return {
    nights: withData.length,
    avgSleepSeconds: avg((n) => n.sleepSeconds),
    avgScore: avg((n) => n.score),
    avgHrv: avg((n) => n.hrvLastNight),
    avgNeedMinutes: avg((n) => n.sleepNeedMinutes),
    avgBedtime: averageClock(times((n) => n.startLocal)),
    avgWake: averageClock(times((n) => n.endLocal)),
  };
}
