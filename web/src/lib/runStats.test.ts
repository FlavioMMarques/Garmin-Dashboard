import { describe, expect, it } from "vitest";
import type { RunSummary } from "../api/runs";
import { periodRange, splitAt, summarize } from "./runStats";

function run(startLocal: string, distanceM: number, movingS: number): RunSummary {
  return {
    id: Math.random(),
    startLocal,
    type: "running",
    distanceM,
    durationS: movingS,
    movingS,
    avgSpeedMps: distanceM / movingS,
    avgHr: 150,
    maxHr: null,
    cadenceSpm: null,
    strideCm: null,
    verticalOscCm: null,
    groundContactMs: null,
    verticalRatio: null,
    powerW: null,
    elevationGainM: null,
    tempC: null,
    aerobicTe: null,
    anaerobicTe: null,
    trainingLabel: null,
    bestS: { "1000": null, "1609": null, "5000": null, "10000": null, "21098": null },
    hrZonesS: null,
  };
}

describe("periodRange", () => {
  const today = new Date(2026, 10, 5); // 2026-11-05 local

  it("computes the current window and the previous one of equal length", () => {
    expect(periodRange("3m", today)).toEqual({ from: "2026-08-06", prevFrom: "2026-05-06" });
    expect(periodRange("6m", today)).toEqual({ from: "2026-05-06", prevFrom: "2025-11-06" });
    expect(periodRange("1y", today)).toEqual({ from: "2025-11-06", prevFrom: "2024-11-06" });
  });

  it("has no bounds for 'all'", () => {
    expect(periodRange("all", today)).toEqual({});
  });

  it("clamps month-end dates instead of overflowing", () => {
    // 31 May minus 3 months → 28 Feb (not 3 March), window starts the day after
    expect(periodRange("3m", new Date(2026, 4, 31)).from).toBe("2026-03-01");
  });
});

describe("splitAt", () => {
  it("splits runs before/after a local date", () => {
    const runs = [run("2026-05-05 07:00:00", 5000, 1500), run("2026-05-06 06:00:00", 5000, 1500)];
    const { previous, current } = splitAt(runs, "2026-05-06");
    expect(previous).toHaveLength(1);
    expect(current).toHaveLength(1);
  });

  it("puts everything in current without a date", () => {
    const runs = [run("2026-05-05 07:00:00", 5000, 1500)];
    expect(splitAt(runs, undefined)).toEqual({ current: runs, previous: [] });
  });
});

describe("summarize", () => {
  it("totals distance and time and derives pace from totals", () => {
    const s = summarize([
      run("2026-01-01 07:00:00", 10000, 3000),
      run("2026-01-02 07:00:00", 5000, 1800),
    ]);
    expect(s).toEqual({
      count: 2,
      distanceM: 15000,
      movingS: 4800,
      avgSpeedMps: 15000 / 4800,
      longestM: 10000,
    });
  });

  it("returns zeros and null pace when empty", () => {
    expect(summarize([])).toEqual({
      count: 0,
      distanceM: 0,
      movingS: 0,
      avgSpeedMps: null,
      longestM: 0,
    });
  });
});
