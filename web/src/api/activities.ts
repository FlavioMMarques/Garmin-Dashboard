import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJson } from "./client";

/** Mirrors server/src/routes/activities.ts. */
export interface ActivitySummary {
  id: number;
  name: string;
  startLocal: string;
  type: string;
  distanceM: number | null;
  durationS: number | null;
  avgSpeedMps: number | null;
  avgHr: number | null;
  calories: number | null;
}

export interface ActivitiesPage {
  items: ActivitySummary[];
  start: number;
  limit: number;
  hasMore: boolean;
}

export const PAGE_SIZE = 20;

export function useActivities(page: number) {
  const start = page * PAGE_SIZE;
  return useQuery({
    queryKey: ["activities", start, PAGE_SIZE],
    queryFn: ({ signal }) =>
      getJson<ActivitiesPage>(`/api/activities?start=${start}&limit=${PAGE_SIZE}`, signal),
    placeholderData: keepPreviousData,
  });
}
