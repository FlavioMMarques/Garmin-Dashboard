import { describe, expect, it } from "vitest";
import { NO_BESTS, mkRun, runSeries } from "../test/runs";
import {
  cadenceInsight,
  contactTimeInsight,
  generateInsights,
  vdotProgressInsight,
  type InsightContext,
} from "./insights";

const ctx = (
  current: ReturnType<typeof runSeries>,
  o: Partial<InsightContext> = {},
): InsightContext => ({
  current,
  from: "2026-05-01",
  today: "2026-11-05",
  window: 5,
  ...o,
});

describe("cadenceInsight", () => {
  it("reports a higher cadence", () => {
    const runs = runSeries(12, "2026-08-01", 4, (i) => ({ cadenceSpm: i < 6 ? 160 : 165 }));
    const insight = cadenceInsight(ctx(runs))!;
    expect(insight.tone).toBe("positive");
    expect(insight.detail).toMatch(/160 → 165 ppm/);
  });

  it("stays quiet for small changes", () => {
    const runs = runSeries(12, "2026-08-01", 4, (i) => ({ cadenceSpm: i < 6 ? 164 : 165 }));
    expect(cadenceInsight(ctx(runs))).toBeNull();
  });
});

describe("contactTimeInsight", () => {
  it("reports a shorter ground contact time", () => {
    const runs = runSeries(12, "2026-08-01", 4, (i) => ({ groundContactMs: i < 6 ? 285 : 270 }));
    expect(contactTimeInsight(ctx(runs))!.detail).toMatch(/285 → 270 ms/);
  });

  it("stays quiet without enough data", () => {
    const runs = runSeries(6, "2026-08-01", 4, (i) => ({ groundContactMs: i < 3 ? 285 : 270 }));
    expect(contactTimeInsight(ctx(runs))).toBeNull();
  });
});

describe("vdotProgressInsight", () => {
  it("compares the estimated VDOT with the previous window", () => {
    const previous = [mkRun(1, "2026-03-01", { bestS: { ...NO_BESTS, "5000": 1680 } })]; // 28:00
    const current = [mkRun(2, "2026-10-01", { bestS: { ...NO_BESTS, "5000": 1560 } })]; // 26:00
    const insight = vdotProgressInsight(ctx(current, { previous }))!;
    expect(insight.tone).toBe("positive");
    expect(insight.detail).toMatch(/VDOT estimado subiu de \d\d,\d para \d\d,\d/);
    expect(insight.detail).toMatch(/5 km/);
  });

  it("stays quiet without a previous window to compare", () => {
    const current = [mkRun(2, "2026-10-01", { bestS: { ...NO_BESTS, "5000": 1560 } })];
    expect(vdotProgressInsight(ctx(current))).toBeNull();
  });
});

describe("generateInsights", () => {
  it("returns every insight that fires, without a cap", () => {
    const runs = runSeries(40, "2026-08-01", 2, (i) => ({
      hrZonesS: [100, 400, 1000, 500, 0],
      avgHr: i < 20 ? 160 : 145,
      cadenceSpm: i < 20 ? 158 : 166,
      trainingLabel: "TEMPO",
      anaerobicTe: 0,
      elevationGainM: 5,
    }));
    expect(generateInsights(ctx(runs, { from: "2026-08-01" })).length).toBeGreaterThan(6);
  });
});
