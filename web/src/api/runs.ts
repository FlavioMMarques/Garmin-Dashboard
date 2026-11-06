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

/** Mirrors KmSplit in server/src/splits.ts. */
export interface KmSplit {
  km: number;
  distanceM: number;
  /** Moving time, pauses excluded. */
  durationS: number;
  paceSecPerKm: number;
  avgHr: number | null;
  cadenceSpm: number | null;
  elevationGainM: number | null;
  /** The last stretch, under a full kilometre. */
  partial: boolean;
}

/** Kilometre splits of one run; fetched only when `enabled` (the activity file is large). */
export function useRunSplits(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ["run-splits", id],
    queryFn: ({ signal }) => getJson<{ splits: KmSplit[] }>(`/api/runs/${id}/splits`, signal),
    select: (r) => r.splits ?? [],
    enabled,
    staleTime: Infinity,
  });
}
