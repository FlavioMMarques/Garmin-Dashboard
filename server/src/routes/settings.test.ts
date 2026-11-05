import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { GarminError, type GarminClient } from "../garminClient.js";
import type { SettingsDeps } from "./settings.js";

const KEY = "GCDC_test-key.123+abc";

function setup(overrides: Partial<SettingsDeps> = {}) {
  const garmin: GarminClient = { get: vi.fn(), checkAuth: async () => {}, reset: vi.fn() };
  const settings: SettingsDeps = {
    isConfigured: () => false,
    verifyKey: vi.fn(async () => {}),
    saveKey: vi.fn(async () => {}),
    ...overrides,
  };
  return { app: createApp(garmin, { settings }), settings, garmin };
}

const post = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", origin: "http://localhost:5173", ...headers },
  body: JSON.stringify(body),
});

describe("GET /api/settings", () => {
  it("reports whether a key is configured, never the key", async () => {
    const { app } = setup({ isConfigured: () => true });
    const res = await app.request("/api/settings");
    expect(await res.json()).toEqual({ configured: true });
  });
});

describe("POST /api/settings/key", () => {
  it("verifies the key with Garmin before saving it, then drops the old token", async () => {
    const { app, settings, garmin } = setup();
    const res = await app.request("/api/settings/key", post({ apiKey: `  ${KEY}  ` }));
    expect(res.status).toBe(200);
    expect(settings.verifyKey).toHaveBeenCalledWith(KEY);
    expect(settings.saveKey).toHaveBeenCalledWith(KEY);
    expect(garmin.reset).toHaveBeenCalled();
    expect(await res.text()).not.toContain(KEY);
  });

  it("does not save a key Garmin rejects", async () => {
    const { app, settings } = setup({
      verifyKey: vi.fn(async () => {
        throw new GarminError("auth_failed", "Chave inválida", 401);
      }),
    });
    const res = await app.request("/api/settings/key", post({ apiKey: KEY }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "invalid_key" });
    expect(settings.saveKey).not.toHaveBeenCalled();
  });

  it("rejects malformed keys without calling Garmin", async () => {
    const { app, settings } = setup();
    for (const apiKey of ["", "a b", "abc\nPORT=1", 42]) {
      const res = await app.request("/api/settings/key", post({ apiKey }));
      expect(res.status, String(apiKey)).toBe(422);
    }
    expect(settings.verifyKey).not.toHaveBeenCalled();
  });

  it("requires a JSON body (blocks cross-site form posts)", async () => {
    const { app, settings } = setup();
    const res = await app.request("/api/settings/key", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "http://localhost:5173",
      },
      body: `apiKey=${KEY}`,
    });
    expect(res.status).toBe(415);
    expect(settings.saveKey).not.toHaveBeenCalled();
  });

  it("refuses requests from other origins (CSRF)", async () => {
    const { app, settings } = setup();
    const res = await app.request(
      "/api/settings/key",
      post({ apiKey: KEY }, { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    expect(settings.verifyKey).not.toHaveBeenCalled();
  });

  it("never logs the key", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { app } = setup({
      saveKey: vi.fn(async () => {
        throw new Error("disk full");
      }),
    });
    const res = await app.request("/api/settings/key", post({ apiKey: KEY }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(log.mock.calls)).not.toContain(KEY);
    log.mockRestore();
  });
});

describe("local-only guard", () => {
  it("rejects any /api request whose Host is not localhost (DNS rebinding)", async () => {
    const { app } = setup();
    const res = await app.request("http://evil.example/api/health");
    expect(res.status).toBe(403);
  });

  it("accepts localhost and 127.0.0.1 on any port", async () => {
    const { app } = setup();
    for (const host of ["http://localhost:5173", "http://127.0.0.1:8787", "http://localhost"]) {
      expect((await app.request(`${host}/api/health`)).status, host).toBe(200);
    }
  });
});
