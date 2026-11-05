import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { GarminClient } from "../garminClient.js";
import fixture from "../fixtures/health.json" with { type: "json" };

function setup() {
  let clock = 0;
  const get = vi.fn(async (path: string) => {
    if (path.startsWith("/usersummary-service")) return fixture.summaries as never;
    if (path.startsWith("/sleep-service")) return fixture.sleep as never;
    if (path.startsWith("/hrv-service")) return fixture.hrv as never;
    throw new Error(`unexpected ${path}`);
  });
  const garmin: GarminClient = { get, checkAuth: async () => {} };
  return {
    app: createApp(garmin, { now: () => clock }),
    get,
    advance: (ms: number) => (clock += ms),
  };
}

const calls = (get: ReturnType<typeof vi.fn>, prefix: string) =>
  get.mock.calls.filter(([p]) => String(p).startsWith(prefix));

describe("GET /api/wellness", () => {
  it("merges summary, sleep and HRV per date with readable fields", async () => {
    const { app } = setup();
    const body = await (await app.request("/api/wellness?from=2026-11-03&to=2026-11-03")).json();
    expect(body.days).toEqual([
      {
        date: "2026-11-03",
        steps: 9677,
        stepsGoal: 9000,
        floors: 7,
        restingHr: 43,
        minHr: 39,
        maxHr: 177,
        stressAvg: 29,
        stressMax: 96,
        bodyBatteryMin: 17,
        bodyBatteryMax: 95,
        bodyBatteryCharged: 44,
        bodyBatteryDrained: 78,
        intensityModerate: 9,
        intensityVigorous: 35,
        intensityGoal: 150,
        caloriesTotal: 2800,
        caloriesActive: 500,
        respirationAvg: 14,
        sleep: {
          totalS: 21900,
          deepS: 3480,
          lightS: 13800,
          remS: 4560,
          awakeS: 60,
          score: 78,
          scoreQualifier: "FAIR",
          startLocal: "2026-11-03T01:27",
          endLocal: "2026-11-03T07:32",
          avgHr: 48,
          avgStress: 12,
        },
        hrv: { lastNightAvg: 58, weeklyAvg: 60, status: "BALANCED" },
      },
    ]);
  });

  it("returns every date in the range, with nulls where the watch has no data", async () => {
    const { app } = setup();
    const body = await (await app.request("/api/wellness?from=2026-11-03&to=2026-11-05")).json();
    expect(body.days.map((d: { date: string }) => d.date)).toEqual([
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
    ]);
    expect(body.days[1]).toMatchObject({
      steps: 4000,
      restingHr: 45,
      stressAvg: null,
      sleep: null,
      hrv: null,
    });
    expect(body.days[2]).toMatchObject({ steps: null, sleep: null });
  });

  it("calls Garmin within each endpoint's range limit (sleep ≤ 31 days)", async () => {
    const { app, get } = setup();
    await app.request("/api/wellness?from=2026-08-07&to=2026-11-04"); // 90 days
    expect(calls(get, "/sleep-service")).toHaveLength(3);
    expect(calls(get, "/usersummary-service")).toHaveLength(1);
    expect(calls(get, "/hrv-service")).toHaveLength(2);
  });

  it("does not leak account identifiers", async () => {
    const { app } = setup();
    const text = await (await app.request("/api/wellness?from=2026-11-03&to=2026-11-04")).text();
    expect(text).not.toContain("123456");
    expect(text).not.toContain("u-1");
  });

  it("caches each range for 10 minutes", async () => {
    const { app, get, advance } = setup();
    await app.request("/api/wellness?from=2026-11-03&to=2026-11-04");
    await app.request("/api/wellness?from=2026-11-03&to=2026-11-04");
    expect(get).toHaveBeenCalledTimes(3);
    advance(10 * 60_000 + 1);
    await app.request("/api/wellness?from=2026-11-03&to=2026-11-04");
    expect(get).toHaveBeenCalledTimes(6);
  });

  it("validates the range", async () => {
    const { app, get } = setup();
    for (const q of [
      "",
      "from=2026-11-03",
      "from=03/11/2026&to=2026-11-04",
      "from=2026-11-05&to=2026-11-04",
      "from=2025-01-01&to=2026-11-04",
    ]) {
      expect((await app.request(`/api/wellness?${q}`)).status, q).toBe(400);
    }
    expect(get).not.toHaveBeenCalled();
  });
});
