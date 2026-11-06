import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { GarminClient, Query } from "../garminClient.js";
import fixture from "../fixtures/sleep.json" with { type: "json" };

const SLEEP_PATH = "/sleep-service/sleep/dailySleepSummariesByDate";

function setup(sleep: unknown[] = fixture.sleep, hrv: unknown = fixture.hrv) {
  let clock = 0;
  const get = vi.fn(
    async (...[path]: [string, Query?]) => (path.startsWith("/hrv") ? hrv : sleep) as never,
  );
  const garmin: GarminClient = { get, checkAuth: async () => {} };
  return {
    app: createApp(garmin, { now: () => clock }),
    get,
    advance: (ms: number) => (clock += ms),
  };
}

type App = ReturnType<typeof setup>["app"];
async function nights(app: App, from: string, to: string) {
  const res = await app.request(`/api/sleep?from=${from}&to=${to}`);
  return (await res.json()).nights as Record<string, unknown>[];
}

describe("GET /api/sleep", () => {
  it("maps a night with its phases, score, timing and overnight HRV", async () => {
    const [night] = await nights(setup().app, "2026-11-04", "2026-11-04");
    expect(night).toEqual({
      date: "2026-11-04",
      hasData: true,
      sleepSeconds: 19800,
      deepSeconds: 4380,
      lightSeconds: 12780,
      remSeconds: 2640,
      awakeSeconds: 1260,
      napSeconds: 0,
      startLocal: "2026-11-04T01:08",
      endLocal: "2026-11-04T06:59",
      score: 68,
      scoreQualifier: "FAIR",
      awakeCount: 1,
      avgSleepStress: 16,
      avgHr: 51,
      avgRespiration: 12,
      avgSpO2: 97,
      sleepNeedMinutes: 530,
      hrvLastNight: 88,
      hrvWeeklyAvg: 99,
      hrvStatus: "BALANCED",
      hrvBalancedLow: 97,
      hrvBalancedUpper: 121,
    });
  });

  it("returns one item per night, ignoring Garmin's empty entries and filling gaps", async () => {
    const list = await nights(setup().app, "2026-10-31", "2026-11-04");
    expect(list.map((n) => n.date)).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(list.map((n) => n.hasData)).toEqual([false, true, true, false, true]);
    expect(list[3]).toMatchObject({ sleepSeconds: null, hrvLastNight: null });
  });

  it("asks Garmin in blocks of at most 31 days", async () => {
    const { app, get } = setup([], { hrvSummaries: [] });
    await nights(app, "2026-08-07", "2026-11-04"); // 90 days
    const sleepCalls = get.mock.calls.filter(([path]) => path === SLEEP_PATH);
    expect(sleepCalls).toHaveLength(3);
    expect(sleepCalls[0]![1]).toEqual({ startDate: "2026-08-07", endDate: "2026-09-06" });
    expect(get.mock.calls.filter(([path]) => path.startsWith("/hrv-service/"))).toHaveLength(3);
  });

  it("rejects malformed, reversed or too long ranges", async () => {
    const { app, get } = setup();
    for (const q of [
      "",
      "from=2026-11-01",
      "from=2026-11-04&to=2026-11-01",
      "from=2025-01-01&to=2026-11-04",
    ]) {
      expect((await app.request(`/api/sleep?${q}`)).status, q).toBe(400);
    }
    expect(get).not.toHaveBeenCalled();
  });

  it("does not leak account or device identifiers", async () => {
    const text = await (
      await setup().app.request("/api/sleep?from=2026-11-01&to=2026-11-04")
    ).text();
    expect(text).not.toContain("123456");
  });

  it("caches each range for 10 minutes", async () => {
    const { app, get, advance } = setup();
    await nights(app, "2026-11-01", "2026-11-04");
    await nights(app, "2026-11-01", "2026-11-04");
    expect(get).toHaveBeenCalledTimes(2); // sleep + HRV, once
    advance(10 * 60_000 + 1);
    await nights(app, "2026-11-01", "2026-11-04");
    expect(get).toHaveBeenCalledTimes(4);
  });
});
