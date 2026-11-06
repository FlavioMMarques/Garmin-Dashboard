/**
 * Minimal client for Google's Gemini API (generateContent), used by "Pergunte".
 * Only the local server holds the key; it goes in a header, never in the URL.
 */

export type GeminiErrorCode =
  "missing_key" | "invalid_key" | "rate_limited" | "blocked" | "upstream";

export class GeminiError extends Error {
  constructor(
    readonly code: GeminiErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export interface AskInput {
  system: string;
  history: ChatTurn[];
  question: string;
}

export interface GeminiClient {
  ask(input: AskInput): Promise<string>;
  /** Throws GeminiError("invalid_key") when Google rejects `key`. */
  verifyKey(key: string): Promise<void>;
}

interface Options {
  apiKey: () => string | undefined;
  model: string;
  /** Tried in order when the model is overloaded or too slow (free tier gets busy). */
  fallbackModels?: string[];
  /** Per attempt. */
  timeoutMs?: number;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface RawPart {
  text?: string;
  thought?: boolean;
}

interface RawResponse {
  candidates?: { content?: { parts?: RawPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

export function createGeminiClient({
  apiKey,
  model,
  fallbackModels = [],
  timeoutMs = 45_000,
  baseUrl = DEFAULT_GEMINI_BASE_URL,
  fetchFn = fetch,
}: Options): GeminiClient {
  const modelUrl = (m: string) => `${baseUrl}/v1beta/models/${encodeURIComponent(m)}`;

  async function send(url: string, key: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await fetchFn(url, {
        ...init,
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = (err as Error).name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new GeminiError("upstream", "O Gemini demorou demais para responder. Tente de novo.");
      }
      throw new GeminiError("upstream", "Não foi possível falar com o Gemini (sem internet?).");
    }
    if (res.ok) return res;
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const detail = body.error?.message ?? "";
    // Google answers a bad key with 400 "API key not valid"; other 400s are real request errors.
    if (res.status === 403 || (res.status === 400 && /api key/i.test(detail))) {
      throw new GeminiError("invalid_key", "O Google recusou a chave do Gemini.", res.status);
    }
    if (res.status === 429) {
      throw new GeminiError(
        "rate_limited",
        "Limite gratuito do Gemini atingido. Espere um minuto e tente de novo.",
        res.status,
      );
    }
    if (res.status === 503) {
      throw new GeminiError(
        "upstream",
        "O Gemini está sobrecarregado agora. Tente de novo em alguns minutos.",
        res.status,
      );
    }
    throw new GeminiError("upstream", `O Gemini respondeu ${res.status}`, res.status);
  }

  /** Overloaded, failing on Google's side or too slow: another model may still answer. */
  const worthAnotherModel = (err: unknown) =>
    err instanceof GeminiError &&
    err.code === "upstream" &&
    (err.status === undefined || err.status >= 500);

  return {
    async ask({ system, history, question }) {
      const key = apiKey();
      if (!key) throw new GeminiError("missing_key", "Chave do Gemini não configurada.");
      const contents = [...history, { role: "user" as const, text: question }].map((t) => ({
        role: t.role,
        parts: [{ text: t.text }],
      }));
      const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents });
      let res: Response | undefined;
      let lastError: unknown;
      for (const m of [model, ...fallbackModels]) {
        try {
          res = await send(`${modelUrl(m)}:generateContent`, key, { method: "POST", body });
          break;
        } catch (err) {
          if (!worthAnotherModel(err)) throw err;
          lastError = err;
        }
      }
      if (!res) throw lastError;
      const data = (await res.json()) as RawResponse;
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => typeof p.text === "string" && !p.thought)
        .map((p) => p.text)
        .join("")
        .trim();
      if (data.promptFeedback?.blockReason || !text) {
        throw new GeminiError(
          "blocked",
          "O Gemini não respondeu a essa pergunta. Tente reformular.",
        );
      }
      return text;
    },

    async verifyKey(key) {
      await send(modelUrl(model), key);
    },
  };
}
