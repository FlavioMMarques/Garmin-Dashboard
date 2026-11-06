import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { GarminClient } from "../garminClient.js";
import fixture from "../fixtures/daily.json" with { type: "json" };

function setup(response: unknown = fixture.day) {
  let clock = 0;
  const get = vi.fn(async () => response as never);
  const garmin: GarminClient = { get, checkAuth: async () => {} };
  return {
    app: createApp(garmin, { now: () => clock }),
    get,
    advance: (ms: number) => (clock += ms),
  };
}

describe("GET /api/daily", () => {
  it("asks Garmin for the requested calendar date", async () => {
    const { app, get } = setup();
    await app.request("/api/daily?date=2026-11-04");
    expect(get).toHaveBeenCalledWith("/usersummary-service/usersummary/daily", {
      calendarDate: "2026-11-04",
    });
  });

  it("returns the day's health summary", async () => {
    const { app } = setup();
    const body = await (await app.request("/api/daily?date=2026-11-04")).json();
    expect(body).toEqual({
      date: "2026-11-04",
      hasData: true,
      steps: 5566,
      stepGoal: 9180,
      distanceMeters: 4656,
      floorsAscended: 8.53215,
      caloriesTotal: 2371,
      caloriesActive: 56,
      restingHr: 46,
      restingHr7dAvg: 44,
      minHr: 41,
      maxHr: 106,
      stressAvg: 27,
      stressMax: 95,
      stressQualifier: "BALANCED",
      bodyBatteryMin: 15,
      bodyBatteryMax: 70,
      bodyBatteryCharged: 59,
      bodyBatteryDrained: 51,
      bodyBatteryAtWake: 70,
      intensityModerate: 0,
      intensityVigorous: 0,
      intensityGoal: 150,
      spo2Avg: 96,
    });
  });

  it("maps a day without data to nulls", async () => {
    const { app } = setup(fixture.empty);
    const body = await (await app.request("/api/daily?date=2012-01-01")).json();
    expect(body).toMatchObject({
      date: "2012-01-01",
      hasData: false,
      steps: null,
      restingHr: null,
    });
  });

  it("does not leak account or device identifiers", async () => {
    const { app } = setup();
    const text = await (await app.request("/api/daily?date=2026-11-04")).text();
    for (const leak of ["123456", "abc-uuid", "display-name"]) expect(text).not.toContain(leak);
  });

  it("rejects a missing or malformed date", async () => {
    const { app, get } = setup();
    expect((await app.request("/api/daily")).status).toBe(400);
    expect((await app.request("/api/daily?date=04/11/2026")).status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it("caches each date for 10 minutes", async () => {
    const { app, get, advance } = setup();
    await app.request("/api/daily?date=2026-11-04");
    await app.request("/api/daily?date=2026-11-04");
    expect(get).toHaveBeenCalledTimes(1);
    await app.request("/api/daily?date=2026-11-03");
    expect(get).toHaveBeenCalledTimes(2);
    advance(10 * 60_000 + 1);
    await app.request("/api/daily?date=2026-11-04");
    expect(get).toHaveBeenCalledTimes(3);
  });
});
