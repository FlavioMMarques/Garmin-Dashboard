import { describe, expect, it } from "vitest";
import type { BestDistance } from "../api/runs";
import {
  bestEfforts,
  efficiencySeries,
  efficiencyTrend,
  monthlyBests,
  vdot,
  vdotFromRuns,
} from "./performance";

type Bests = Record<BestDistance, number | null>;
const NO_BESTS: Bests = { "1000": null, "1609": null, "5000": null, "10000": null, "21098": null };

function run(
  id: number,
  startLocal: string,
  opts: { km?: number; secPerKm?: number; hr?: number | null; bests?: Partial<Bests> } = {},
) {
  const { km = 5, secPerKm = 330, hr = 150, bests = {} } = opts;
  return {
    id,
    startLocal,
    distanceM: km * 1000,
    avgSpeedMps: 1000 / secPerKm,
    avgHr: hr,
    bestS: { ...NO_BESTS, ...bests },
  };
}

describe("vdot", () => {
  it("matches Daniels' tables", () => {
    expect(vdot(5000, 20 * 60)).toBeCloseTo(49.8, 1);
    expect(vdot(10000, 41 * 60 + 21)).toBeCloseTo(50, 0);
    expect(vdot(21097.5, 1 * 3600 + 31 * 60 + 35)).toBeCloseTo(50, 0);
  });
});

describe("efficiencySeries", () => {
  it("computes meters per heartbeat and a rolling median", () => {
    // 5:00/km = 200 m/min; at 160 bpm → 1.25 m/beat
    const series = efficiencySeries(
      [
        run(1, "2026-10-01 07:00:00", { secPerKm: 300, hr: 160 }),
        run(2, "2026-10-02 07:00:00", { secPerKm: 300, hr: 200 }),
        run(3, "2026-10-03 07:00:00", { secPerKm: 300, hr: 125 }),
      ],
      3,
    );
    expect(series.map((p) => p.metersPerBeat)).toEqual([1.25, 1, 1.6]);
    expect(series.map((p) => p.rolling)).toEqual([1.25, 1.125, 1.25]);
  });

  it("skips runs without heart rate", () => {
    const series = efficiencySeries([run(1, "2026-10-01 07:00:00", { hr: null })], 3);
    expect(series).toEqual([]);
  });
});

describe("bestEfforts", () => {
  it("finds the fastest time per distance with its date", () => {
    const runs = [
      run(1, "2026-09-01 07:00:00", { bests: { "1000": 300, "5000": 1600 } }),
      run(2, "2026-10-01 07:00:00", { bests: { "1000": 290, "5000": 1650 } }),
    ];
    const bests = bestEfforts(runs);
    expect(bests["1000"]).toEqual({ seconds: 290, runId: 2, startLocal: "2026-10-01 07:00:00" });
    expect(bests["5000"]).toMatchObject({ seconds: 1600, runId: 1 });
    expect(bests["10000"]).toBeNull();
  });
});

describe("monthlyBests", () => {
  it("returns the best time per month and the record so far", () => {
    const runs = [
      run(1, "2026-08-10 07:00:00", { bests: { "5000": 1700 } }),
      run(2, "2026-08-20 07:00:00", { bests: { "5000": 1650 } }),
      run(3, "2026-10-05 07:00:00", { bests: { "5000": 1680 } }),
      run(4, "2026-11-01 07:00:00", { bests: { "5000": 1600 } }),
    ];
    expect(monthlyBests(runs, "5000")).toEqual([
      { month: "2026-08", best: 1650, record: 1650 },
      { month: "2026-10", best: 1680, record: 1650 },
      { month: "2026-11", best: 1600, record: 1600 },
    ]);
  });
});

describe("vdotFromRuns", () => {
  it("uses the best VDOT among 5 km, 10 km and half-marathon efforts", () => {
    const runs = [
      run(1, "2026-10-01 07:00:00", { bests: { "1000": 200, "5000": 1500, "10000": 3300 } }),
    ];
    const result = vdotFromRuns(runs)!;
    expect(result.distance).toBe("5000"); // 25:00 5 km beats 55:00 10 km; 1 km is ignored
    expect(result.value).toBeCloseTo(vdot(5000, 1500), 5);
  });

  it("is null without long-enough efforts", () => {
    expect(vdotFromRuns([run(1, "2026-10-01 07:00:00", { bests: { "1000": 200 } })])).toBeNull();
  });
});

describe("efficiencyTrend", () => {
  it("compares the first full window with the latest rolling median", () => {
    const series = efficiencySeries(
      [
        run(1, "2026-10-01 07:00:00", { secPerKm: 300, hr: 125 }), // 1.6
        run(2, "2026-10-02 07:00:00", { secPerKm: 300, hr: 200 }), // 1.0
        run(3, "2026-10-03 07:00:00", { secPerKm: 300, hr: 160 }), // 1.25
        run(4, "2026-10-04 07:00:00", { secPerKm: 300, hr: 125 }), // 1.6
      ],
      3,
    );
    expect(efficiencyTrend(series, 3)).toEqual({ first: 1.25, last: 1.25 });
  });
});
