import type { Night } from "../api/sleep";

const DAY_MIN = 24 * 60;
const NOON = 12 * 60;

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** "YYYY-MM-DDTHH:MM" → minutes after midnight. */
const clockMinutes = (local: string) =>
  Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));

/**
 * Minutes since the previous noon, so night-time clock times compare and average
 * without a jump at midnight (23:30 → 690, 00:30 → 750).
 */
export const minutesFromNoon = (local: string) => (clockMinutes(local) - NOON + DAY_MIN) % DAY_MIN;

/** Inverse of minutesFromNoon: back to minutes after midnight. */
export const clockFromNoon = (fromNoon: number) => Math.round(fromNoon + NOON) % DAY_MIN;

/** Average time of day, in minutes after midnight; 23:30 and 00:30 average to 00:00. */
export function averageClock(locals: string[]): number | null {
  const fromNoon = mean(locals.map(minutesFromNoon));
  return fromNoon == null ? null : clockFromNoon(fromNoon);
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
