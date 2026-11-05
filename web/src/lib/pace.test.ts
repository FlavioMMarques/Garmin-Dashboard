import { describe, expect, it } from "vitest";
import { distanceBucket, paceSeries } from "./pace";

type R = { id: number; startLocal: string; distanceM: number | null; avgSpeedMps: number | null };
const run = (id: number, km: number, secPerKm: number): R => ({
  id,
  startLocal: `2026-10-${String(id).padStart(2, "0")} 07:00:00`,
  distanceM: km * 1000,
  avgSpeedMps: 1000 / secPerKm,
});

describe("distanceBucket", () => {
  it("splits at 8 and 15 km", () => {
    expect(distanceBucket(7999)).toBe("short");
    expect(distanceBucket(8000)).toBe("medium");
    expect(distanceBucket(15000)).toBe("medium");
    expect(distanceBucket(15001)).toBe("long");
  });
});

describe("paceSeries", () => {
  it("computes pace per run and a trailing average within each bucket", () => {
    const series = paceSeries([run(1, 5, 360), run(2, 10, 330), run(3, 5, 340), run(4, 5, 320)], 2);
    expect(series.map((p) => [p.id, p.bucket, Math.round(p.secPerKm), p.rollingSecPerKm])).toEqual([
      [1, "short", 360, 360],
      [2, "medium", 330, 330],
      [3, "short", 340, 350], // avg(360, 340) — the 10 km run is another bucket
      [4, "short", 320, 330], // avg(340, 320) — window of 2
    ]);
  });

  it("skips runs without distance or speed", () => {
    const noSpeed = { ...run(1, 5, 300), avgSpeedMps: null };
    expect(paceSeries([noSpeed, run(2, 5, 300)], 3)).toHaveLength(1);
  });
});
