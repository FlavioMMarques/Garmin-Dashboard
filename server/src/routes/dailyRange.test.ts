import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { GarminClient, Query } from "../garminClient.js";
import fixture from "../fixtures/dailyRange.json" with { type: "json" };

const V2_PATH = "/usersummary-service/v2/dailysummaries";

function setup(data: unknown[] = fixture.data) {
  let clock = 0;
  const get = vi.fn(async (_path: string, _query?: Query) => ({ data }) as never);
  const garmin: GarminClient = { get, checkAuth: async () => {} };
  return {
    app: createApp(garmin, { now: () => clock }),
    get,
    advance: (ms: number) => (clock += ms),
  };
}

async function days(app: ReturnType<typeof setup>["app"], from: string, to: string) {
  const res = await app.request(`/api/daily/range?from=${from}&to=${to}`);
  return (await res.json()).days as Record<string, unknown>[];
}

describe("GET /api/daily/range", () => {
  it("maps each day to the fields the insights use", async () => {
    const { app } = setup();
    const [first] = await days(app, "2026-11-01", "2026-11-01");
    expect(first).toEqual({
      date: "2026-11-01",
      hasData: true,
      steps: 3060,
      stepGoal: 11780,
      restingHr: 46,
      stressAvg: 32,
      stressHighShare: 0.03,
      bodyBatteryMin: 5,
      bodyBatteryMax: 63,
      bodyBatteryCharged: 63,
      bodyBatteryDrained: 24,
      intensityModerate: 0,
      intensityVigorous: 0,
      intensityGoal: 150,
      caloriesActive: 34,
    });
  });

  it("returns one item per day, in order, filling the days Garmin omits", async () => {
    const { app } = setup();
    const list = await days(app, "2026-10-31", "2026-11-04");
    expect(list.map((d) => d.date)).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(list.map((d) => d.hasData)).toEqual([false, true, true, false, true]);
    expect(list[3]).toMatchObject({ steps: null, restingHr: null });
  });

  it("asks Garmin once for up to 366 days", async () => {
    const { app, get } = setup([]);
    await days(app, "2025-11-04", "2026-11-04");
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(V2_PATH, { startDate: "2025-11-04", endDate: "2026-11-04" });
  });

  it("splits 400 days into two calls", async () => {
    const { app, get } = setup([]);
    const list = await days(app, "2025-10-01", "2026-11-04");
    expect(get).toHaveBeenCalledTimes(2);
    expect(list).toHaveLength(400);
  });

  it("rejects malformed, reversed or too long ranges", async () => {
    const { app, get } = setup();
    for (const q of [
      "",
      "from=2026-11-01",
      "from=01/11/2026&to=2026-11-04",
      "from=2026-11-04&to=2026-11-01",
      "from=2025-01-01&to=2026-11-04",
    ]) {
      expect((await app.request(`/api/daily/range?${q}`)).status, q).toBe(400);
    }
    expect(get).not.toHaveBeenCalled();
  });

  it("does not leak account or device identifiers", async () => {
    const { app } = setup();
    const text = await (await app.request("/api/daily/range?from=2026-11-01&to=2026-11-04")).text();
    for (const leak of ["123456", "abc-uuid"]) expect(text).not.toContain(leak);
  });

  it("caches each range for 10 minutes", async () => {
    const { app, get, advance } = setup();
    await days(app, "2026-11-01", "2026-11-04");
    await days(app, "2026-11-01", "2026-11-04");
    expect(get).toHaveBeenCalledTimes(1);
    advance(10 * 60_000 + 1);
    await days(app, "2026-11-01", "2026-11-04");
    expect(get).toHaveBeenCalledTimes(2);
  });
});
