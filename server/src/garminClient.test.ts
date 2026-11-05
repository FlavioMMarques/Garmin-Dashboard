import { describe, expect, it, vi } from "vitest";
import { createGarminClient, GarminError } from "./garminClient.js";

const BASE = "https://garmin.test";
const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Fake JWT like the real endpoint returns (plain text, `exp` in seconds). */
function jwt(id: string, expSeconds: number) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ jti: id, exp: expSeconds })}.sig`;
}

function text(body: string) {
  return new Response(body, { headers: { "content-type": "text/plain" } });
}

function setup(opts: { apiKey?: string; tokenResponse?: () => Response } = {}) {
  let clock = 0;
  let tokenCount = 0;
  const dataResponses: Response[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === TOKEN_PATH) {
      tokenCount++;
      return opts.tokenResponse?.() ?? text(jwt(`tok${tokenCount}`, (clock + 86400_000) / 1000));
    }
    return (
      dataResponses.shift() ??
      json({ url: url.toString(), auth: new Headers(init?.headers).get("authorization") })
    );
  });
  const client = createGarminClient({
    apiKey: "apiKey" in opts ? opts.apiKey : "secret",
    baseUrl: BASE,
    fetch: fetchMock as typeof fetch,
    now: () => clock,
  });
  return {
    client,
    fetchMock,
    tokenCalls: () => tokenCount,
    advance: (ms: number) => (clock += ms),
    queue: (r: Response) => dataResponses.push(r),
  };
}

describe("garminClient", () => {
  it("exchanges the API key for a token using the ApiKey scheme", async () => {
    const { client, fetchMock } = setup();
    await client.get("/x");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(BASE + TOKEN_PATH);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("ApiKey secret");
    // Garmin answers 406 when the token request asks for JSON.
    expect(new Headers(init?.headers).get("accept") ?? "").not.toMatch(/json/);
  });

  it("calls data endpoints with a bearer token and query params", async () => {
    const { client } = setup();
    const res = await client.get<{ url: string; auth: string }>("/sleep", {
      startDate: "2026-01-01",
      endDate: undefined,
    });
    expect(res.auth).toBe(`Bearer ${jwt("tok1", 86400)}`);
    expect(res.url).toBe(`${BASE}/sleep?startDate=2026-01-01`);
  });

  it("reuses the token across calls", async () => {
    const { client, tokenCalls } = setup();
    await Promise.all([client.get("/a"), client.get("/b")]);
    await client.get("/c");
    expect(tokenCalls()).toBe(1);
  });

  it("refreshes the token shortly before it expires", async () => {
    const { client, tokenCalls, advance } = setup();
    await client.get("/a");
    advance(86400_000 - 4 * 60_000);
    await client.get("/b");
    expect(tokenCalls()).toBe(2);
  });

  it("uses the JWT exp claim for expiry", async () => {
    const { client, tokenCalls, advance } = setup({
      tokenResponse: () => text(jwt("short", 3600)),
    });
    await client.get("/a");
    advance(50 * 60_000);
    await client.get("/b");
    expect(tokenCalls()).toBe(1);
    advance(6 * 60_000);
    await client.get("/c");
    expect(tokenCalls()).toBe(2);
  });

  it("also accepts a JSON token body and defaults to 24h validity", async () => {
    const { client, tokenCalls, advance } = setup({
      tokenResponse: () => json({ accessToken: "camel" }),
    });
    const res = await client.get<{ auth: string }>("/a");
    expect(res.auth).toBe("Bearer camel");
    advance(60 * 60_000);
    await client.get("/b");
    expect(tokenCalls()).toBe(1);
  });

  it("gets a new token and retries once on 401", async () => {
    const { client, tokenCalls, queue } = setup();
    queue(json({}, 401));
    const res = await client.get<{ auth: string }>("/a");
    expect(res.auth).toBe(`Bearer ${jwt("tok2", 86400)}`);
    expect(tokenCalls()).toBe(2);
  });

  it("fails with missing_key when no key is configured", async () => {
    const { client, fetchMock } = setup({ apiKey: "" });
    await expect(client.get("/a")).rejects.toMatchObject({ code: "missing_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps upstream errors to typed codes", async () => {
    const { client, queue } = setup();
    queue(json({}, 429));
    await expect(client.get("/a")).rejects.toMatchObject({ code: "rate_limited", status: 429 });
    queue(json({}, 500));
    await expect(client.get("/a")).rejects.toBeInstanceOf(GarminError);
  });

  it("rejects an empty token response", async () => {
    const { client } = setup({ tokenResponse: () => text("  ") });
    await expect(client.get("/a")).rejects.toMatchObject({ code: "upstream" });
  });

  it("reads the key again on each token exchange, so a renewed key works without restart", async () => {
    let key: string | undefined = undefined;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === TOKEN_PATH) {
        const auth = new Headers(init?.headers).get("authorization");
        return auth === "ApiKey new" ? text(jwt("fresh", 86400)) : json({}, 401);
      }
      return json({ ok: true });
    });
    const client = createGarminClient({
      apiKey: () => key,
      baseUrl: BASE,
      fetch: fetchMock as typeof fetch,
      now: () => 0,
    });

    await expect(client.get("/a")).rejects.toMatchObject({ code: "missing_key" });
    key = "expired";
    await expect(client.get("/a")).rejects.toMatchObject({ code: "auth_failed" });
    key = "new";
    await expect(client.get("/a")).resolves.toEqual({ ok: true });
  });

  it("reports auth_failed when the key is rejected", async () => {
    const fetchMock = vi.fn(async () => json({ message: "invalid" }, 401));
    const client = createGarminClient({
      apiKey: "bad",
      baseUrl: BASE,
      fetch: fetchMock as typeof fetch,
    });
    await expect(client.get("/a")).rejects.toMatchObject({ code: "auth_failed" });
  });
});
