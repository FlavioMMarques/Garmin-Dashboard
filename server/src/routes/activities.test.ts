import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { GarminClient } from "../garminClient.js";
import fixtureJson from "../fixtures/activities.json" with { type: "json" };
import { mapActivity, type RawActivity } from "./activities.js";

const fixture = fixtureJson as RawActivity[];

function appWith(get: GarminClient["get"]) {
  return createApp({ get, checkAuth: async () => {} });
}

describe("mapActivity", () => {
  it("keeps only the fields the UI uses", () => {
    expect(mapActivity(fixture[0]!)).toEqual({
      id: 1001,
      name: "Corrida de teste",
      startLocal: "2026-01-10 07:30:00",
      type: "running",
      distanceM: 5000.5,
      durationS: 1800.25,
      avgSpeedMps: 2.7777,
      avgHr: 150,
      calories: 400,
    });
  });

  it("uses null for missing metrics", () => {
    expect(mapActivity(fixture[2]!)).toMatchObject({
      type: "strength_training",
      distanceM: null,
      avgSpeedMps: null,
      avgHr: null,
    });
  });
});

describe("GET /api/activities", () => {
  it("asks Garmin for one extra item to know whether there is a next page", async () => {
    const get = vi.fn(async () => fixture as never);
    const res = await appWith(get).request("/api/activities?start=20&limit=2");
    expect(get).toHaveBeenCalledWith("/activitylist-service/activities/search/activities", {
      start: 20,
      limit: 3,
    });
    const body = await res.json();
    expect(body.items.map((a: { id: number }) => a.id)).toEqual([1001, 1002]);
    expect(body).toMatchObject({ start: 20, limit: 2, hasMore: true });
  });

  it("reports hasMore=false on the last page", async () => {
    const get = vi.fn(async () => fixture as never);
    const body = await (await appWith(get).request("/api/activities?limit=20")).json();
    expect(body).toMatchObject({ start: 0, limit: 20, hasMore: false });
    expect(body.items).toHaveLength(3);
  });

  it("does not leak personal fields", async () => {
    const get = vi.fn(async () => fixture as never);
    const text = await (await appWith(get).request("/api/activities")).text();
    expect(text).not.toContain("Pessoa Exemplo");
    expect(text).not.toContain("Latitude");
  });

  it("rejects invalid paging params", async () => {
    const get = vi.fn();
    for (const q of ["start=-1", "limit=0", "limit=101", "start=abc"]) {
      const res = await appWith(get).request(`/api/activities?${q}`);
      expect(res.status, q).toBe(400);
    }
    expect(get).not.toHaveBeenCalled();
  });
});
