import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { GarminClient } from "../garminClient.js";
import fixture from "../fixtures/profile.json" with { type: "json" };

function setup(activities: unknown[] = [fixture.activity]) {
  let clock = 0;
  const get = vi.fn(
    async (path: string) => (path.includes("userprofile") ? fixture.settings : activities) as never,
  );
  const garmin: GarminClient = { get, checkAuth: async () => {} };
  return {
    app: createApp(garmin, { now: () => clock }),
    get,
    advance: (ms: number) => (clock += ms),
  };
}

describe("GET /api/profile", () => {
  it("returns only the name, photo and display preferences", async () => {
    const { app } = setup();
    const body = await (await app.request("/api/profile")).json();
    expect(body).toEqual({
      fullName: "Pessoa Exemplo",
      photoUrl: "https://example.test/medium.png",
      locale: "pt_BR",
      measurementSystem: "metric",
      timeZone: "America/Sao_Paulo",
      firstDayOfWeek: "sunday",
    });
  });

  it("does not leak other owner or location fields", async () => {
    const { app } = setup();
    const text = await (await app.request("/api/profile")).text();
    for (const leak of ["123456", "abc-uuid", "00000000", "Latitude", "large.png"]) {
      expect(text).not.toContain(leak);
    }
  });

  it("works without activities (no name or photo)", async () => {
    const { app } = setup([]);
    const body = await (await app.request("/api/profile")).json();
    expect(body).toMatchObject({ fullName: null, photoUrl: null, firstDayOfWeek: "sunday" });
  });

  it("caches for an hour", async () => {
    const { app, get, advance } = setup();
    await app.request("/api/profile");
    await app.request("/api/profile");
    expect(get).toHaveBeenCalledTimes(2); // settings + latest activity, once
    advance(60 * 60_000 + 1);
    await app.request("/api/profile");
    expect(get).toHaveBeenCalledTimes(4);
  });
});
