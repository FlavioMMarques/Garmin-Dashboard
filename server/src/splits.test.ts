import { describe, expect, it } from "vitest";
import { kmSplits, type TrackPoint } from "./splits.js";

/** One point per second at a steady speed, with optional per-second overrides. */
function steady(
  seconds: number,
  mps: number,
  over: (t: number) => Partial<TrackPoint> = () => ({}),
): TrackPoint[] {
  return Array.from({ length: seconds + 1 }, (_, t) => ({
    t,
    distanceM: t * mps,
    hr: 150,
    cadenceSpm: 170,
    altitudeM: 10,
    ...over(t),
  }));
}

describe("kmSplits", () => {
  it("cuts a split at every kilometre with the time interpolated", () => {
    // 4 m/s → 250 s per km; 2.2 km.
    const splits = kmSplits(steady(550, 4));
    expect(splits.map((s) => [s.km, s.distanceM, s.durationS])).toEqual([
      [1, 1000, 250],
      [2, 1000, 250],
      [3, 200, 50],
    ]);
    expect(splits[0]!.paceSecPerKm).toBe(250);
    expect(splits[2]).toMatchObject({ partial: true, paceSecPerKm: 250 });
  });

  it("averages heart rate and cadence within each kilometre", () => {
    const splits = kmSplits(
      steady(500, 4, (t) => ({ hr: t <= 250 ? 140 : 160, cadenceSpm: t <= 250 ? 168 : 174 })),
    );
    expect(splits.map((s) => s.avgHr)).toEqual([140, 160]);
    expect(splits.map((s) => s.cadenceSpm)).toEqual([168, 174]);
  });

  it("adds up the climb within each kilometre", () => {
    const splits = kmSplits(steady(500, 4, (t) => ({ altitudeM: t <= 250 ? 10 + t * 0.04 : 20 })));
    expect(splits[0]!.elevationGainM).toBe(10);
    expect(splits[1]!.elevationGainM).toBe(0);
  });

  it("does not count a pause as running time", () => {
    // Runs 125 s, pauses for 5 minutes (no points), then resumes at the same distance.
    const before = steady(125, 4);
    const after = steady(125, 4).map((p) => ({
      ...p,
      t: p.t + 125 + 300,
      distanceM: 500 + p.distanceM,
    }));
    const [km] = kmSplits([...before, ...after]);
    expect(km!.durationS).toBe(250);
  });

  it("drops a final stretch under 50 m and ignores points without distance", () => {
    const points = [
      ...steady(1010 / 4, 4),
      { t: 300, distanceM: null, hr: 150, cadenceSpm: null, altitudeM: null },
    ];
    expect(kmSplits(points).map((s) => s.km)).toEqual([1]);
  });

  it("returns nothing without distance", () => {
    expect(kmSplits([])).toEqual([]);
  });
});
