import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { GarminClient } from "../garminClient.js";
import fixtureJson from "../fixtures/runs.json" with { type: "json" };
import { mapRun, type RawRun } from "./runs.js";

const fixture = fixtureJson as RawRun[];

function setup(pages: RawRun[][] = [fixture]) {
  let clock = 0;
  const get = vi.fn(async (_path: string, query?: Record<string, unknown>) => {
    const index = Number(query?.start ?? 0) / 100;
    return (pages[index] ?? []) as never;
  });
  const garmin: GarminClient = {
    get,
    checkAuth: async () => {},
    getBinary: async () => Buffer.alloc(0),
  };
  const app = createApp(garmin, { now: () => clock });
  return { app, get, advance: (ms: number) => (clock += ms) };
}

describe("mapRun", () => {
  it("maps running fields with readable names and units", () => {
    expect(mapRun(fixture[0]!)).toEqual({
      id: 2002,
      startLocal: "2026-02-03 19:00:00",
      type: "running",
      distanceM: 10000,
      durationS: 3000,
      movingS: 2990,
      avgSpeedMps: 3.3333,
      avgHr: 160,
      maxHr: 175,
      cadenceSpm: 170.4,
      strideCm: 117.5,
      verticalOscCm: 8.7,
      groundContactMs: 260.2,
      verticalRatio: 7.4,
      powerW: 360,
      elevationGainM: 20,
      tempC: 28,
      aerobicTe: 3.6,
      anaerobicTe: 0.4,
      trainingLabel: "TEMPO",
      bestS: { "1000": 290.5, "1609": 470.1, "5000": 1490.2, "10000": 2995, "21098": null },
      hrZonesS: [100, 400, 1200, 1300, 0],
    });
  });

  it("uses null for metrics the watch did not record", () => {
    const run = mapRun(fixture[1]!);
    expect(run).toMatchObject({ powerW: null, tempC: null, maxHr: null, hrZonesS: null });
    expect(run.movingS).toBe(1800); // falls back to duration
  });
});

describe("GET /api/runs", () => {
  it("queries running activities from the given date, oldest first in the response", async () => {
    const { app, get } = setup();
    const body = await (await app.request("/api/runs?from=2026-01-01")).json();
    expect(get).toHaveBeenCalledWith("/activitylist-service/activities/search/activities", {
      activityType: "running",
      startDate: "2026-01-01",
      start: 0,
      limit: 100,
    });
    expect(body.runs.map((r: { id: number }) => r.id)).toEqual([2001, 2002]);
  });

  it("pages through Garmin until a short page", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...fixture[1]!, activityId: i }));
    const { app, get } = setup([full, full, fixture]);
    const body = await (await app.request("/api/runs")).json();
    expect(get).toHaveBeenCalledTimes(3);
    expect(get.mock.calls[0]![1]).not.toHaveProperty("startDate");
    expect(body.runs).toHaveLength(202);
  });

  it("caches for 10 minutes per period", async () => {
    const { app, get, advance } = setup();
    await app.request("/api/runs?from=2026-01-01");
    await app.request("/api/runs?from=2026-01-01");
    expect(get).toHaveBeenCalledTimes(1);
    await app.request("/api/runs?from=2025-01-01");
    expect(get).toHaveBeenCalledTimes(2);
    advance(10 * 60_000 + 1);
    await app.request("/api/runs?from=2026-01-01");
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("does not cache failures", async () => {
    const { app, get } = setup();
    get.mockRejectedValueOnce(new Error("boom"));
    expect((await app.request("/api/runs")).status).toBe(500);
    expect((await app.request("/api/runs")).status).toBe(200);
  });

  it("does not leak personal fields", async () => {
    const { app } = setup();
    const text = await (await app.request("/api/runs")).text();
    expect(text).not.toContain("Pessoa Exemplo");
    expect(text).not.toContain("Latitude");
  });

  it("rejects a malformed date", async () => {
    const { app, get } = setup();
    expect((await app.request("/api/runs?from=01/02/2026")).status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });
});
