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

function setup(opts: { apiKey?: string; tokenBody?: unknown } = {}) {
  let clock = 0;
  let tokenCount = 0;
  const dataResponses: Response[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === TOKEN_PATH) {
      tokenCount++;
      return json(opts.tokenBody ?? { access_token: `tok${tokenCount}`, expires_in: 86400 });
    }
    return dataResponses.shift() ?? json({ url: url.toString(), auth: new Headers(init?.headers).get("authorization") });
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
  });

  it("calls data endpoints with a bearer token and query params", async () => {
    const { client } = setup();
    const res = await client.get<{ url: string; auth: string }>("/sleep", {
      startDate: "2026-01-01",
      endDate: undefined,
    });
    expect(res.auth).toBe("Bearer tok1");
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

  it("accepts camelCase token fields and defaults to 24h validity", async () => {
    const { client, tokenCalls, advance } = setup({ tokenBody: { accessToken: "camel" } });
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
    expect(res.auth).toBe("Bearer tok2");
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

  it("reports auth_failed when the key is rejected", async () => {
    const fetchMock = vi.fn(async () => json({ message: "invalid" }, 401));
    const client = createGarminClient({ apiKey: "bad", baseUrl: BASE, fetch: fetchMock as typeof fetch });
    await expect(client.get("/a")).rejects.toMatchObject({ code: "auth_failed" });
  });
});
