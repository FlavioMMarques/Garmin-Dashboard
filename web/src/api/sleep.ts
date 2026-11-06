import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJson } from "./client";

/** Mirrors server/src/routes/sleep.ts. */
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
  sleepNeedMinutes: number | null;
  hrvLastNight: number | null;
  hrvWeeklyAvg: number | null;
  hrvStatus: string | null;
  hrvBalancedLow: number | null;
  hrvBalancedUpper: number | null;
}

/** Every night from `from` to `to` (both included), oldest first. */
export function useSleep(from: string, to: string) {
  return useQuery({
    queryKey: ["sleep", from, to],
    queryFn: ({ signal }) =>
      getJson<{ nights: Night[] }>(`/api/sleep?from=${from}&to=${to}`, signal),
    // Never undefined: with keepPreviousData an undefined result re-renders forever.
    select: (r) => r.nights ?? [],
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
