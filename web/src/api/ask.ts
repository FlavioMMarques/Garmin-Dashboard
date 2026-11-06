import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, postJson } from "./client";

/** One message of a "Pergunte" conversation; mirrors ChatTurn in server/src/geminiClient.ts. */
export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export function useAskSettings() {
  return useQuery({
    queryKey: ["ask-settings"],
    queryFn: ({ signal }) => getJson<{ configured: boolean }>("/api/ask/settings", signal),
    retry: false,
  });
}

/** Send a typed Gemini key to the local server, which checks it with Google before saving. */
export function useSaveGeminiKey() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) => postJson<{ ok: true }>("/api/ask/key", { apiKey }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ask-settings"] }),
  });
}

export function useAsk() {
  return useMutation({
    mutationFn: (input: { question: string; history: ChatTurn[]; context: string }) =>
      postJson<{ answer: string }>("/api/ask", input).then((r) => r.answer),
  });
}
