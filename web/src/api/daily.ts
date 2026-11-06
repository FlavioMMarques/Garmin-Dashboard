import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJson } from "./client";

/** Mirrors server/src/routes/daily.ts. */
export interface DailySummary {
  date: string;
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

export function useDaily(date: string) {
  return useQuery({
    queryKey: ["daily", date],
    queryFn: ({ signal }) => getJson<DailySummary>(`/api/daily?date=${date}`, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
