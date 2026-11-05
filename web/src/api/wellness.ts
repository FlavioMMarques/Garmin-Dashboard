import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJson } from "./client";

/** Mirrors server/src/routes/health.ts. */
export interface SleepNight {
  totalS: number | null;
  deepS: number | null;
  lightS: number | null;
  remS: number | null;
  awakeS: number | null;
  score: number | null;
  scoreQualifier: string | null;
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
  /** The night that ended on this date. */
  sleep: SleepNight | null;
  hrv: { lastNightAvg: number | null; weeklyAvg: number | null; status: string | null } | null;
}

/** Every date in [from, to] (inclusive), oldest first. */
export function useWellness(from: string, to: string) {
  return useQuery<HealthDay[]>({
    queryKey: ["wellness", from, to],
    queryFn: ({ signal }) =>
      getJson<{ days: HealthDay[] }>(`/api/wellness?from=${from}&to=${to}`, signal).then(
        (r) => r.days,
      ),
    placeholderData: keepPreviousData,
  });
}
