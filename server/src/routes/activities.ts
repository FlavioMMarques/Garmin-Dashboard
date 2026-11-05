import { Hono } from "hono";
import type { GarminClient } from "../garminClient.js";

const SEARCH_PATH = "/activitylist-service/activities/search/activities";
const MAX_LIMIT = 100;

/** Only the Garmin fields we read; everything else (owner, GPS, ...) is dropped. */
export interface RawActivity {
  activityId: number;
  activityName?: string | null;
  startTimeLocal: string;
  activityType?: { typeKey?: string } | null;
  distance?: number | null;
  duration?: number | null;
  averageSpeed?: number | null;
  averageHR?: number | null;
  calories?: number | null;
}

export interface ActivitySummary {
  id: number;
  name: string;
  /** "YYYY-MM-DD HH:mm:ss" in the activity's local time. */
  startLocal: string;
  /** Garmin typeKey, e.g. "running", "cycling". */
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

export function mapActivity(raw: RawActivity): ActivitySummary {
  return {
    id: raw.activityId,
    name: raw.activityName ?? "",
    startLocal: raw.startTimeLocal,
    type: raw.activityType?.typeKey ?? "other",
    distanceM: raw.distance ?? null,
    durationS: raw.duration ?? null,
    avgSpeedMps: raw.averageSpeed ?? null,
    avgHr: raw.averageHR ?? null,
    calories: raw.calories ?? null,
  };
}

function parseIntParam(value: string | undefined, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

export function activitiesRoutes(garmin: GarminClient) {
  return new Hono().get("/activities", async (c) => {
    const start = parseIntParam(c.req.query("start"), 0, 0, Number.MAX_SAFE_INTEGER);
    const limit = parseIntParam(c.req.query("limit"), 20, 1, MAX_LIMIT);
    if (start === undefined || limit === undefined) {
      return c.json(
        { error: "bad_request", message: `start ≥ 0 e limit entre 1 e ${MAX_LIMIT}` },
        400,
      );
    }
    // One extra item tells us whether a next page exists; Garmin answers 400 past the end.
    const raw =
      (await garmin.get<RawActivity[] | null>(SEARCH_PATH, { start, limit: limit + 1 })) ?? [];
    const page: ActivitiesPage = {
      items: raw.slice(0, limit).map(mapActivity),
      start,
      limit,
      hasMore: raw.length > limit,
    };
    return c.json(page);
  });
}
