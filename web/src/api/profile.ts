import { useQuery } from "@tanstack/react-query";
import { getJson } from "./client";

/** Mirrors server/src/routes/profile.ts. */
export interface Profile {
  fullName: string | null;
  photoUrl: string | null;
  locale: string | null;
  measurementSystem: string | null;
  timeZone: string | null;
  firstDayOfWeek: string | null;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => getJson<Profile>("/api/profile", signal),
    staleTime: 60 * 60_000,
    retry: false,
  });
}
