import { Hono } from "hono";
import type { GarminClient } from "../garminClient.js";

const SETTINGS_PATH = "/userprofile-service/userprofile/settings";
const SEARCH_PATH = "/activitylist-service/activities/search/activities";
const CACHE_TTL_MS = 60 * 60_000;

interface RawSettings {
  preferredLocale?: string | null;
  measurementSystem?: string | null;
  timeZone?: string | null;
  firstDayOfWeek?: { dayName?: string | null } | null;
}

/** Only the owner fields we expose; the rest of the activity is ignored. */
interface RawOwner {
  ownerFullName?: string | null;
  ownerProfileImageUrlMedium?: string | null;
  ownerProfileImageUrlSmall?: string | null;
}

export interface Profile {
  /** The settings endpoint has no name (displayName is a UUID); it comes from activity ownership. */
  fullName: string | null;
  photoUrl: string | null;
  locale: string | null;
  measurementSystem: string | null;
  timeZone: string | null;
  /** Lower-case English day name, e.g. "sunday" or "monday". */
  firstDayOfWeek: string | null;
}

export function profileRoutes(
  garmin: GarminClient,
  { now = Date.now, onReset }: { now?: () => number; onReset?: (reset: () => void) => void } = {},
) {
  let cached: { expiresAt: number; profile: Promise<Profile> } | undefined;
  onReset?.(() => (cached = undefined));

  async function load(): Promise<Profile> {
    const [settings, activities] = await Promise.all([
      garmin.get<RawSettings | null>(SETTINGS_PATH),
      garmin.get<RawOwner[] | null>(SEARCH_PATH, { start: 0, limit: 1 }),
    ]);
    const owner = activities?.[0];
    return {
      fullName: owner?.ownerFullName ?? null,
      photoUrl: owner?.ownerProfileImageUrlMedium ?? owner?.ownerProfileImageUrlSmall ?? null,
      locale: settings?.preferredLocale ?? null,
      measurementSystem: settings?.measurementSystem ?? null,
      timeZone: settings?.timeZone ?? null,
      firstDayOfWeek: settings?.firstDayOfWeek?.dayName?.toLowerCase() ?? null,
    };
  }

  return new Hono().get("/profile", async (c) => {
    if (!cached || now() >= cached.expiresAt) {
      const profile = load();
      cached = { expiresAt: now() + CACHE_TTL_MS, profile };
      profile.catch(() => {
        if (cached?.profile === profile) cached = undefined;
      });
    }
    return c.json(await cached.profile);
  });
}
