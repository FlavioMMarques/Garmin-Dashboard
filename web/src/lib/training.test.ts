import { describe, expect, it } from "vitest";
import { heatBins, labelCounts, metricSeries, weeklyZones, zoneShare } from "./training";

type Zones = [number, number, number, number, number];
const run = (
  id: number,
  startLocal: string,
  extra: Partial<{
    hrZonesS: Zones | null;
    cadenceSpm: number | null;
    trainingLabel: string | null;
    tempC: number | null;
    avgSpeedMps: number | null;
    distanceM: number | null;
  }> = {},
) => ({
  id,
  startLocal,
  hrZonesS: null,
  cadenceSpm: null,
  trainingLabel: null,
  tempC: null,
  avgSpeedMps: null,
  distanceM: 5000,
  ...extra,
});

describe("weeklyZones", () => {
  it("sums seconds per HR zone per ISO week, with empty weeks as zero", () => {
    const weeks = weeklyZones(
      [
        run(1, "2026-10-06 07:00:00", { hrZonesS: [60, 600, 1200, 300, 0] }),
        run(2, "2026-10-08 07:00:00", { hrZonesS: [0, 300, 600, 0, 0] }),
        run(3, "2026-10-20 07:00:00", { hrZonesS: null }),
      ],
      "2026-10-05",
      "2026-10-25",
    );
    expect(weeks).toEqual([
      { weekStart: "2026-10-05", zones: [60, 900, 1800, 300, 0], totalS: 3060 },
      { weekStart: "2026-10-12", zones: [0, 0, 0, 0, 0], totalS: 0 },
      { weekStart: "2026-10-19", zones: [0, 0, 0, 0, 0], totalS: 0 },
    ]);
  });
});

describe("zoneShare", () => {
  it("splits HR time into easy (Z1–2), moderate (Z3) and hard (Z4–5)", () => {
    const share = zoneShare([
      run(1, "2026-10-06 07:00:00", { hrZonesS: [100, 100, 500, 200, 100] }),
    ]);
    expect(share).toEqual({ easy: 0.2, moderate: 0.5, hard: 0.3 });
  });

  it("is null without HR zone data", () => {
    expect(zoneShare([run(1, "2026-10-06 07:00:00")])).toBeNull();
  });
});

describe("metricSeries", () => {
  it("maps a metric to points with a rolling median, skipping missing values", () => {
    const series = metricSeries(
      [
        run(1, "2026-10-01 07:00:00", { cadenceSpm: 160 }),
        run(2, "2026-10-02 07:00:00", { cadenceSpm: null }),
        run(3, "2026-10-03 07:00:00", { cadenceSpm: 106 }), // walk-like outlier
        run(4, "2026-10-04 07:00:00", { cadenceSpm: 166 }),
      ],
      (r) => r.cadenceSpm,
      3,
    );
    expect(series.map((p) => [p.id, p.value, p.rolling])).toEqual([
      [1, 160, 160],
      [3, 106, 133],
      [4, 166, 160],
    ]);
  });
});

describe("labelCounts", () => {
  it("counts training types, most frequent first, with pt-BR names", () => {
    const counts = labelCounts([
      run(1, "2026-10-01 07:00:00", { trainingLabel: "TEMPO" }),
      run(2, "2026-10-02 07:00:00", { trainingLabel: "AEROBIC_BASE" }),
      run(3, "2026-10-03 07:00:00", { trainingLabel: "TEMPO" }),
      run(4, "2026-10-04 07:00:00", { trainingLabel: null }),
      run(5, "2026-10-05 07:00:00", { trainingLabel: "SOMETHING_NEW" }),
    ]);
    expect(counts).toEqual([
      { label: "TEMPO", name: "Tempo", count: 2 },
      { label: "AEROBIC_BASE", name: "Base aeróbica", count: 1 },
      { label: "SOMETHING_NEW", name: "something new", count: 1 },
    ]);
  });
});

describe("heatBins", () => {
  it("groups runs into temperature bands with the median pace of each", () => {
    const bins = heatBins(
      [
        run(1, "2026-10-01 07:00:00", { tempC: 22.5, avgSpeedMps: 1000 / 330 }),
        run(2, "2026-10-02 07:00:00", { tempC: 23.9, avgSpeedMps: 1000 / 340 }),
        run(3, "2026-10-03 07:00:00", { tempC: 28, avgSpeedMps: 1000 / 360 }),
        run(4, "2026-10-04 07:00:00", { tempC: null, avgSpeedMps: 1000 / 300 }),
      ],
      2,
    );
    expect(bins).toEqual([
      { fromC: 22, toC: 24, count: 2, medianSecPerKm: 335 },
      { fromC: 28, toC: 30, count: 1, medianSecPerKm: 360 },
    ]);
  });
});
