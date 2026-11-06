import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { isPlausibleApiKey } from "../envFile.js";
import {
  GeminiError,
  type ChatTurn,
  type GeminiClient,
  type GeminiErrorCode,
} from "../geminiClient.js";
import { rejectCrossSiteWrite } from "../localGuard.js";

export interface AskDeps {
  gemini: GeminiClient;
  /** Whether a Gemini key is configured (never the key itself). */
  isConfigured(): boolean;
  /** Persist the key (to .env). */
  saveKey(key: string): Promise<void>;
}

const MAX_QUESTION = 2_000;
const MAX_TURNS = 40;
const MAX_TURN_TEXT = 12_000;
/** The dashboard summary the browser builds; generous, but bounded. */
const MAX_CONTEXT = 300_000;

const STATUS: Record<GeminiErrorCode, ContentfulStatusCode> = {
  missing_key: 503,
  invalid_key: 401,
  rate_limited: 429,
  blocked: 422,
  upstream: 502,
};

export function systemPrompt(context: string): string {
  return [
    "Você é um analista de dados de corrida e saúde dentro de um painel pessoal do Garmin.",
    "Responda em português do Brasil, de forma direta e curta, citando os números dos dados.",
    "Use apenas os dados abaixo. Se a resposta não estiver neles, diga que o painel não tem essa informação, em vez de inventar.",
    "Os números já foram calculados pelo painel: prefira citá-los a refazer contas.",
    "Correlações nos dados não provam causa; diga isso quando relevante.",
    "Não dê diagnóstico médico. Diante de sinais preocupantes (dor, FC muito fora do padrão), sugira procurar um profissional.",
    'Formate em texto simples: parágrafos curtos e listas com "- "; sem tabelas, títulos ou negrito.',
    "",
    "=== DADOS DO PAINEL ===",
    context,
  ].join("\n");
}

function parseHistory(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || value.length > MAX_TURNS) return null;
  const turns: ChatTurn[] = [];
  for (const t of value) {
    const turn = t as Partial<ChatTurn> | null;
    if (
      (turn?.role !== "user" && turn?.role !== "model") ||
      typeof turn.text !== "string" ||
      turn.text.length > MAX_TURN_TEXT
    ) {
      return null;
    }
    turns.push({ role: turn.role, text: turn.text });
  }
  return turns;
}

const badRequest = (message: string) => ({ error: "bad_request", message });

/** "Pergunte": questions about the dashboard data, answered by Gemini. */
export function askRoutes(deps: AskDeps) {
  return new Hono()
    .get("/ask/settings", (c) => c.json({ configured: deps.isConfigured() }))
    .post("/ask", async (c) => {
      const rejected = rejectCrossSiteWrite(c);
      if (rejected) return rejected;
      const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      const question = typeof body?.question === "string" ? body.question.trim() : "";
      const context = typeof body?.context === "string" ? body.context : "";
      const history = parseHistory(body?.history ?? []);
      if (!question || question.length > MAX_QUESTION) {
        return c.json(badRequest(`Escreva uma pergunta de até ${MAX_QUESTION} caracteres.`), 400);
      }
      if (!history) return c.json(badRequest("Histórico da conversa inválido."), 400);
      if (context.length > MAX_CONTEXT) return c.json(badRequest("Dados grandes demais."), 400);

      try {
        const answer = await deps.gemini.ask({ system: systemPrompt(context), history, question });
        return c.json({ answer });
      } catch (err) {
        if (err instanceof GeminiError) {
          return c.json({ error: `gemini_${err.code}`, message: err.message }, STATUS[err.code]);
        }
        throw err;
      }
    })
    .post("/ask/key", async (c) => {
      const rejected = rejectCrossSiteWrite(c);
      if (rejected) return rejected;
      const body = (await c.req.json().catch(() => null)) as { apiKey?: unknown } | null;
      const key = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
      if (!isPlausibleApiKey(key)) {
        return c.json(
          { error: "invalid_format", message: "Isso não parece uma chave do Gemini." },
          422,
        );
      }

      try {
        await deps.gemini.verifyKey(key);
      } catch (err) {
        if (err instanceof GeminiError && err.code === "invalid_key") {
          return c.json(
            {
              error: "invalid_key",
              message: "O Google recusou essa chave. Confira se copiou a chave inteira.",
            },
            422,
          );
        }
        if (err instanceof GeminiError) {
          return c.json({ error: `gemini_${err.code}`, message: err.message }, STATUS[err.code]);
        }
        throw err;
      }

      try {
        await deps.saveKey(key);
      } catch (err) {
        console.error("[ask] não foi possível salvar a chave:", (err as Error).message);
        return c.json(
          { error: "internal", message: "Não foi possível salvar o arquivo .env" },
          500,
        );
      }
      return c.json({ ok: true });
    });
}
