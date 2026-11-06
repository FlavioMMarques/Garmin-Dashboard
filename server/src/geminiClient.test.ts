import { describe, expect, it, vi } from "vitest";
import { createGeminiClient, GeminiError } from "./geminiClient.js";

const BASE = "https://gemini.test";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function reply(...texts: string[]) {
  return json({
    candidates: [{ content: { role: "model", parts: texts.map((text) => ({ text })) } }],
  });
}

function setup(response: () => Response, { noKey = false } = {}) {
  const apiKey = noKey ? undefined : "AIza-test";
  const fetchFn = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    async () => response(),
  );
  const client = createGeminiClient({
    apiKey: () => apiKey,
    model: "gemini-test-flash",
    baseUrl: BASE,
    fetchFn,
  });
  const call = (i = 0) => {
    const [input, init] = fetchFn.mock.calls[i]!;
    return {
      url: new URL(String(input)),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? "null")),
    };
  };
  return { client, fetchFn, call };
}

const ASK = {
  system: "Você analisa treinos.",
  history: [
    { role: "user" as const, text: "Quantos km corri?" },
    { role: "model" as const, text: "281 km." },
  ],
  question: "E no mês passado?",
};

describe("geminiClient.ask", () => {
  it("sends the system prompt, the conversation and the new question to generateContent", async () => {
    const { client, call } = setup(() => reply("Foram 72 km."));
    await client.ask(ASK);

    const { url, headers, body } = call();
    expect(url.href).toBe(`${BASE}/v1beta/models/gemini-test-flash:generateContent`);
    expect(headers.get("x-goog-api-key")).toBe("AIza-test");
    expect(url.search).toBe(""); // the key never goes in the URL (it would end up in logs)
    expect(body.systemInstruction).toEqual({ parts: [{ text: ASK.system }] });
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Quantos km corri?" }] },
      { role: "model", parts: [{ text: "281 km." }] },
      { role: "user", parts: [{ text: "E no mês passado?" }] },
    ]);
  });

  it("returns the answer text, joining the text parts", async () => {
    const { client } = setup(() => reply("Foram ", "72 km."));
    expect(await client.ask(ASK)).toBe("Foram 72 km.");
  });

  it("skips the model's thought parts", async () => {
    const { client } = setup(() =>
      json({
        candidates: [
          {
            content: {
              parts: [{ text: "pensando…", thought: true }, { text: "Resposta." }],
            },
          },
        ],
      }),
    );
    expect(await client.ask(ASK)).toBe("Resposta.");
  });

  it("fails with missing_key before calling Google when no key is set", async () => {
    const { client, fetchFn } = setup(() => reply("x"), { noKey: true });
    await expect(client.ask(ASK)).rejects.toMatchObject({ code: "missing_key" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    [400, { error: { status: "INVALID_ARGUMENT", message: "API key not valid." } }],
    [403, { error: { status: "PERMISSION_DENIED", message: "denied" } }],
  ])("maps a rejected key (%i) to invalid_key", async (status, body) => {
    const { client } = setup(() => json(body, status));
    await expect(client.ask(ASK)).rejects.toMatchObject({ code: "invalid_key" });
  });

  it("maps 429 to rate_limited", async () => {
    const { client } = setup(() => json({ error: { status: "RESOURCE_EXHAUSTED" } }, 429));
    const err = await client.ask(ASK).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err).toMatchObject({ code: "rate_limited" });
  });

  it("maps other HTTP errors to upstream", async () => {
    const { client } = setup(() => json({}, 500));
    await expect(client.ask(ASK)).rejects.toMatchObject({ code: "upstream" });
  });

  it("reports a blocked prompt instead of an empty answer", async () => {
    const { client } = setup(() => json({ promptFeedback: { blockReason: "SAFETY" } }));
    await expect(client.ask(ASK)).rejects.toMatchObject({ code: "blocked" });
  });

  it("reports an answer with no text as blocked", async () => {
    const { client } = setup(() =>
      json({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }),
    );
    await expect(client.ask(ASK)).rejects.toMatchObject({ code: "blocked" });
  });
});

describe("geminiClient.verifyKey", () => {
  it("checks a typed key against the configured model, not the saved one", async () => {
    const { client, call } = setup(() => json({ name: "models/gemini-test-flash" }));
    await client.verifyKey("AIza-new");
    const { url, headers } = call();
    expect(url.href).toBe(`${BASE}/v1beta/models/gemini-test-flash`);
    expect(headers.get("x-goog-api-key")).toBe("AIza-new");
  });

  it("throws invalid_key when Google rejects it", async () => {
    const { client } = setup(() => json({ error: { message: "API key not valid." } }, 400));
    await expect(client.verifyKey("bad")).rejects.toMatchObject({ code: "invalid_key" });
  });
});

describe("geminiClient fallback and timeout", () => {
  /** Answers per model: a Response, or "hang" to never answer (until aborted). */
  function multi(byModel: Record<string, Response | "hang">, timeoutMs = 1_000) {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const model = /models\/([^:/]+)/.exec(String(input))![1]!;
      const answer = byModel[model];
      if (answer === "hang" || !answer) {
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        );
      }
      return answer.clone();
    });
    const client = createGeminiClient({
      apiKey: () => "AIza-test",
      model: "main-flash",
      fallbackModels: ["lite-flash"],
      timeoutMs,
      baseUrl: BASE,
      fetchFn,
    });
    const models = () => fetchFn.mock.calls.map(([u]) => /models\/([^:/]+)/.exec(String(u))![1]);
    return { client, models };
  }

  const busy = () => json({ error: { status: "UNAVAILABLE", message: "high demand" } }, 503);

  it("tries the fallback model when the main one is overloaded", async () => {
    const { client, models } = multi({ "main-flash": busy(), "lite-flash": reply("ok lite") });
    expect(await client.ask(ASK)).toBe("ok lite");
    expect(models()).toEqual(["main-flash", "lite-flash"]);
  });

  it("tries the fallback model when the main one does not answer in time", async () => {
    const { client } = multi({ "main-flash": "hang", "lite-flash": reply("ok lite") }, 20);
    expect(await client.ask(ASK)).toBe("ok lite");
  });

  it("does not fall back on a rejected key or the rate limit", async () => {
    const { client, models } = multi({
      "main-flash": json({ error: {} }, 429),
      "lite-flash": reply("x"),
    });
    await expect(client.ask(ASK)).rejects.toMatchObject({ code: "rate_limited" });
    expect(models()).toEqual(["main-flash"]);
  });

  it("explains that Gemini is busy when every model is overloaded", async () => {
    const { client } = multi({ "main-flash": busy(), "lite-flash": busy() });
    await expect(client.ask(ASK)).rejects.toMatchObject({
      code: "upstream",
      message: expect.stringMatching(/sobrecarregado/),
    });
  });

  it("gives up with a timeout message when nothing answers", async () => {
    const { client } = multi({ "main-flash": "hang", "lite-flash": "hang" }, 20);
    await expect(client.ask(ASK)).rejects.toMatchObject({
      code: "upstream",
      message: expect.stringMatching(/demorou/),
    });
  });
});
