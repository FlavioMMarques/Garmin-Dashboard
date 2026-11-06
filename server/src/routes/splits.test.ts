import { FitBaseType, FitEncoder } from "fit-file-parser/encoder";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { GarminClient } from "../garminClient.js";
import { garminStyleZip } from "../test/garminZip.js";

const START = new Date("2026-11-05T22:10:00Z");
const LAT = 123456789; // a fake position, in semicircles

/** A synthetic run: one record per second at 4 m/s, 150 bpm, 170 spm, with GPS. */
function syntheticFit(seconds: number): Buffer {
  const enc = new FitEncoder();
  enc.writeMessage(0, [{ number: 0, size: 1, baseType: FitBaseType.Enum, value: 4 }]); // file_id: activity
  for (let t = 0; t <= seconds; t++) {
    enc.writeMessage(20, [
      {
        number: 253,
        size: 4,
        baseType: FitBaseType.Uint32,
        value: FitEncoder.toFitTimestamp(new Date(START.getTime() + t * 1000)),
      },
      { number: 0, size: 4, baseType: FitBaseType.Sint32, value: LAT },
      { number: 1, size: 4, baseType: FitBaseType.Sint32, value: -LAT },
      { number: 5, size: 4, baseType: FitBaseType.Uint32, value: t * 4 * 100 }, // distance, cm
      { number: 3, size: 1, baseType: FitBaseType.Uint8, value: 150 }, // heart rate
      { number: 4, size: 1, baseType: FitBaseType.Uint8, value: 85 }, // cadence per leg
      { number: 78, size: 4, baseType: FitBaseType.Uint32, value: (10 + 500) * 5 }, // enhanced altitude 10 m
    ]);
  }
  return Buffer.from(enc.close());
}

function setup(
  zip: Buffer = garminStyleZip([{ name: "123_ACTIVITY.fit", content: syntheticFit(550) }]),
) {
  let clock = 0;
  const getBinary = vi.fn(async () => zip);
  const garmin: GarminClient = { get: vi.fn(), getBinary, checkAuth: async () => {} };
  return {
    app: createApp(garmin, { now: () => clock }),
    getBinary,
    advance: (ms: number) => (clock += ms),
  };
}

describe("GET /api/runs/:id/splits", () => {
  it("downloads the activity file and returns kilometre splits", async () => {
    const { app, getBinary } = setup();
    const res = await app.request("/api/runs/123/splits");
    expect(getBinary).toHaveBeenCalledWith("/download-service/files/activity/123");
    const body = await res.json();
    expect(body.splits.map((s: { km: number; durationS: number }) => [s.km, s.durationS])).toEqual([
      [1, 250],
      [2, 250],
      [3, 50],
    ]);
    expect(body.splits[0]).toMatchObject({ avgHr: 150, cadenceSpm: 170, elevationGainM: 0 });
  });

  it("never sends GPS positions to the browser", async () => {
    const text = await (await setup().app.request("/api/runs/123/splits")).text();
    expect(Object.keys(JSON.parse(text))).toEqual(["splits"]);
    expect(text).not.toMatch(/position|lat|long|123456789/i);
  });

  it("rejects an id that is not a number", async () => {
    const { app, getBinary } = setup();
    expect((await app.request("/api/runs/abc/splits")).status).toBe(400);
    expect(getBinary).not.toHaveBeenCalled();
  });

  it("reports a download without a .FIT file as an upstream error", async () => {
    const zip = garminStyleZip([{ name: "notes.txt", content: Buffer.from("x") }]);
    expect((await setup(zip).app.request("/api/runs/123/splits")).status).toBe(502);
  });

  it("caches each activity", async () => {
    const { app, getBinary } = setup();
    await app.request("/api/runs/123/splits");
    await app.request("/api/runs/123/splits");
    expect(getBinary).toHaveBeenCalledTimes(1);
  });
});
