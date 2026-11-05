import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { GarminClient } from "./garminClient.js";
import { createRootApp } from "./root.js";

function webDist() {
  const dir = mkdtempSync(join(tmpdir(), "garmin-web-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>Garmin Dashboard</title>");
  writeFileSync(join(dir, "assets", "app.js"), "console.log('app')");
  return dir;
}

function setup(dist: string | null = webDist()) {
  const garmin: GarminClient = { get: async () => ({}) as never, checkAuth: async () => {} };
  return createRootApp(createApp(garmin), dist);
}

describe("createRootApp", () => {
  it("serves the built web app at /", async () => {
    const res = await setup().request("http://localhost:8787/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Garmin Dashboard");
  });

  it("serves built assets", async () => {
    const res = await setup().request("http://localhost:8787/assets/app.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("keeps the API under /api", async () => {
    const res = await setup().request("http://localhost:8787/api/health");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("sends security headers with a same-origin CSP", async () => {
    const res = await setup().request("http://localhost:8787/");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("explains how to build when the web app is missing", async () => {
    const res = await setup(null).request("http://localhost:8787/");
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("npm run build");
  });
});
