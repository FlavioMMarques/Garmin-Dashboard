import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJson } from "./client";

export type BestDistance = "1000" | "1609" | "5000" | "10000" | "21098";

/** Mirrors server/src/routes/runs.ts. */
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
  tempC: number | null;
  aerobicTe: number | null;
  anaerobicTe: number | null;
  trainingLabel: string | null;
  bestS: Record<BestDistance, number | null>;
  hrZonesS: [number, number, number, number, number] | null;
}

/** All runs since `from` (YYYY-MM-DD, local), oldest first; `undefined` = whole history. */
export function useRuns(from: string | undefined) {
  return useQuery<RunSummary[]>({
    queryKey: ["runs", from ?? "all"],
    queryFn: ({ signal }) =>
      getJson<{ runs: RunSummary[] }>(`/api/runs${from ? `?from=${from}` : ""}`, signal).then(
        (r) => r.runs,
      ),
    placeholderData: keepPreviousData,
  });
}
