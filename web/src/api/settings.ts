import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, postJson } from "./client";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: ({ signal }) => getJson<{ configured: boolean }>("/api/settings", signal),
    retry: false,
  });
}

/** Whether the configured key currently works (token exchange with Garmin). */
export function useKeyStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: ({ signal }) => getJson<{ ok: true }>("/api/status", signal),
    retry: false,
  });
}

/** Send a typed key to the local server; on success every cached query is refetched. */
export function useSaveKey() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) => postJson<{ ok: true }>("/api/settings/key", { apiKey }),
    onSuccess: () => client.invalidateQueries(),
  });
}
