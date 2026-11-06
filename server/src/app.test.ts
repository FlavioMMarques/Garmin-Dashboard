import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { GarminError, type GarminClient } from "./garminClient.js";

function fakeClient(overrides: Partial<GarminClient> = {}): GarminClient {
  return {
    get: async () => ({}) as never,
    checkAuth: async () => {},
    getBinary: async () => Buffer.alloc(0),
    ...overrides,
  };
}

describe("app", () => {
  it("GET /api/health returns ok", async () => {
    const res = await createApp(fakeClient()).request("/api/health");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("GET /api/status returns ok when the token exchange works", async () => {
    const res = await createApp(fakeClient()).request("/api/status");
    expect(res.status).toBe(200);
  });

  it("maps GarminError to a JSON error with matching HTTP status", async () => {
    const app = createApp(
      fakeClient({
        checkAuth: async () => {
          throw new GarminError("missing_key", "sem chave");
        },
      }),
    );
    const res = await app.request("/api/status");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "missing_key", message: "sem chave" });
  });
});
