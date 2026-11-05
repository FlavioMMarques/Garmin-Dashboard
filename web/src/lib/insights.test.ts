import { describe, expect, it } from "vitest";
import type { RunSummary } from "../api/runs";
import {
  consistencyInsight,
  easyPaceInsight,
  efficiencyInsight,
  generateInsights,
  heatInsight,
  intensityInsight,
  monotonyInsight,
  paceTrendInsight,
  recordsInsight,
  volumeRampInsight,
  type InsightContext,
} from "./insights";

const NO_BESTS = { "1000": null, "1609": null, "5000": null, "10000": null, "21098": null };

function mk(id: number, day: string, o: Partial<RunSummary> = {}): RunSummary {
  return {
    id,
    startLocal: `${day} 07:00:00`,
    type: "running",
    distanceM: 6000,
    durationS: 2100,
    movingS: 2100,
    avgSpeedMps: 1000 / 350,
    avgHr: 155,
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
    bestS: NO_BESTS,
    hrZonesS: null,
    ...o,
  };
}

/** `n` runs, one every `everyDays` days starting at `start`, customised per index. */
function series(
  n: number,
  start: string,
  everyDays: number,
  f: (i: number) => Partial<RunSummary> = () => ({}),
): RunSummary[] {
  const [y, m, d] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(y!, m! - 1, d! + i * everyDays);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return mk(i + 1, iso, f(i));
  });
}

const ctx = (current: RunSummary[], o: Partial<InsightContext> = {}): InsightContext => ({
  current,
  from: "2026-05-01",
  today: "2026-11-05",
  window: 5,
  ...o,
});

describe("intensityInsight", () => {
  it("flags too little easy time", () => {
    const runs = series(10, "2026-09-01", 3, () => ({ hrZonesS: [100, 400, 1000, 500, 0] }));
    const insight = intensityInsight(ctx(runs))!;
    expect(insight.tone).toBe("attention");
    expect(insight.detail).toContain("25%");
    expect(insight.detail).toContain("50%");
  });

  it("praises a mostly easy distribution", () => {
    const runs = series(10, "2026-09-01", 3, () => ({ hrZonesS: [200, 1400, 300, 100, 0] }));
    expect(intensityInsight(ctx(runs))!.tone).toBe("positive");
  });

  it("stays quiet with under 3 hours of HR data", () => {
    const runs = series(2, "2026-09-01", 3, () => ({ hrZonesS: [100, 400, 1000, 500, 0] }));
    expect(intensityInsight(ctx(runs))).toBeNull();
  });
});

describe("easyPaceInsight", () => {
  // 10 km in 53:12 → VDOT ≈ 37 → easy pace ≈ 6:12–7:24 /km, threshold ≈ 5:24
  const vdotRun = mk(99, "2026-10-01", { bestS: { ...NO_BESTS, "10000": 3192 } });

  it("flags easy-labelled runs faster than the suggested easy pace", () => {
    const easy = series(4, "2026-09-01", 3, () => ({
      trainingLabel: "AEROBIC_BASE",
      avgSpeedMps: 1000 / 350, // 5:50
    }));
    const insight = easyPaceInsight(ctx([...easy, vdotRun]))!;
    expect(insight.tone).toBe("attention");
    expect(insight.detail).toMatch(/5:50 \/km/);
    expect(insight.detail).toMatch(/6:1\d \/km/);
  });

  it("falls back to the typical run when few runs are labelled easy", () => {
    const runs = series(6, "2026-09-01", 3, () => ({ avgSpeedMps: 1000 / 350 }));
    const insight = easyPaceInsight(ctx([...runs, vdotRun]))!;
    expect(insight.title).toMatch(/típica/);
  });

  it("stays quiet when easy runs are within the easy range", () => {
    const easy = series(4, "2026-09-01", 3, () => ({
      trainingLabel: "AEROBIC_BASE",
      avgSpeedMps: 1000 / 400, // 6:40
    }));
    expect(easyPaceInsight(ctx([...easy, vdotRun]))).toBeNull();
  });
});

describe("monotonyInsight", () => {
  it("notes when one training type dominates", () => {
    const runs = series(10, "2026-09-01", 3, (i) => ({
      trainingLabel: i < 7 ? "TEMPO" : "AEROBIC_BASE",
    }));
    const insight = monotonyInsight(ctx(runs))!;
    expect(insight.detail).toContain("7 de 10");
    expect(insight.detail).toContain("Tempo");
  });

  it("stays quiet when types are varied", () => {
    const labels = ["TEMPO", "AEROBIC_BASE", "VO2MAX", "LACTATE_THRESHOLD"];
    const runs = series(12, "2026-09-01", 3, (i) => ({ trainingLabel: labels[i % 4]! }));
    expect(monotonyInsight(ctx(runs))).toBeNull();
  });
});

describe("efficiencyInsight", () => {
  it("reports a clear improvement", () => {
    // pace constant, heart rate drops from 160 to 145
    const runs = series(12, "2026-08-01", 4, (i) => ({ avgHr: i < 6 ? 160 : 145 }));
    const insight = efficiencyInsight(ctx(runs))!;
    expect(insight.tone).toBe("positive");
    expect(insight.detail).toMatch(/\+10%/);
  });

  it("stays quiet when the change is small", () => {
    const runs = series(12, "2026-08-01", 4, (i) => ({ avgHr: i < 6 ? 155 : 154 }));
    expect(efficiencyInsight(ctx(runs))).toBeNull();
  });
});

describe("paceTrendInsight", () => {
  it("reports faster short runs", () => {
    const runs = series(12, "2026-08-01", 4, (i) => ({ avgSpeedMps: 1000 / (i < 6 ? 360 : 340) }));
    const insight = paceTrendInsight(ctx(runs))!;
    expect(insight.tone).toBe("positive");
    expect(insight.detail).toMatch(/6:00 → 5:40/);
  });

  it("stays quiet with too few runs in the bucket", () => {
    const runs = series(6, "2026-08-01", 4, (i) => ({ avgSpeedMps: 1000 / (i < 3 ? 360 : 340) }));
    expect(paceTrendInsight(ctx(runs))).toBeNull();
  });
});

describe("recordsInsight", () => {
  const pr = mk(1, "2026-05-30", { bestS: { ...NO_BESTS, "5000": 1563 } }); // 26:03

  it("says when a recent effort came close to an old record", () => {
    const recent = mk(2, "2026-10-20", { bestS: { ...NO_BESTS, "5000": 1590 } }); // 26:30, +1.7%
    const insight = recordsInsight(ctx([pr, recent]))!;
    expect(insight.tone).toBe("positive");
    expect(insight.detail).toContain("26:03");
    expect(insight.detail).toContain("26:30");
  });

  it("notes an old record not approached recently", () => {
    const recent = mk(2, "2026-10-20", { bestS: { ...NO_BESTS, "5000": 1700 } }); // +8.8%
    expect(recordsInsight(ctx([pr, recent]))!.tone).toBe("info");
  });

  it("stays quiet when the record is recent", () => {
    const fresh = mk(1, "2026-10-25", { bestS: { ...NO_BESTS, "5000": 1563 } });
    expect(recordsInsight(ctx([fresh]))).toBeNull();
  });
});

describe("volumeRampInsight", () => {
  it("flags a fast increase over the last four weeks", () => {
    // 2 runs/week of 6 km for 4 weeks, then 2 runs/week of 10 km for 4 weeks
    const runs = series(16, "2026-09-07", 3.5, (i) => ({ distanceM: i < 8 ? 6000 : 10000 }));
    const insight = volumeRampInsight(ctx(runs, { today: "2026-11-05" }))!;
    expect(insight.tone).toBe("attention");
    expect(insight.detail).toMatch(/\+\d+%/);
  });

  it("stays quiet when volume is steady", () => {
    const runs = series(16, "2026-09-07", 3.5);
    expect(volumeRampInsight(ctx(runs, { today: "2026-11-05" }))).toBeNull();
  });
});

describe("consistencyInsight", () => {
  it("reports a break of two or more weeks", () => {
    const runs = [...series(4, "2026-06-01", 3), ...series(4, "2026-07-20", 3)];
    const insight = consistencyInsight(ctx(runs, { from: "2026-06-01", today: "2026-08-02" }))!;
    expect(insight.tone).toBe("info");
    expect(insight.detail).toMatch(/\d semanas/);
  });

  it("praises a long streak of weeks with runs", () => {
    const runs = series(20, "2026-08-31", 3.5);
    const insight = consistencyInsight(ctx(runs, { from: "2026-08-31", today: "2026-11-05" }))!;
    expect(insight.tone).toBe("positive");
  });
});

describe("heatInsight", () => {
  it("estimates the pace cost of heat", () => {
    const cool = series(4, "2026-06-01", 3, () => ({ tempC: 22.5, avgSpeedMps: 1000 / 340 }));
    const hot = series(4, "2026-09-01", 3, () => ({ tempC: 30.5, avgSpeedMps: 1000 / 355 }));
    const insight = heatInsight(ctx([...cool, ...hot]))!;
    expect(insight.detail).toMatch(/15 s\/km/);
  });

  it("stays quiet without enough runs in each band", () => {
    const cool = series(1, "2026-06-01", 3, () => ({ tempC: 22.5, avgSpeedMps: 1000 / 340 }));
    const hot = series(1, "2026-09-01", 3, () => ({ tempC: 30.5, avgSpeedMps: 1000 / 380 }));
    expect(heatInsight(ctx([...cool, ...hot]))).toBeNull();
  });
});

describe("generateInsights", () => {
  it("orders attention → positive → info and caps the list", () => {
    const runs = series(30, "2026-08-01", 3, (i) => ({
      hrZonesS: [100, 400, 1000, 500, 0],
      avgHr: i < 15 ? 160 : 145,
      trainingLabel: "TEMPO",
    }));
    const insights = generateInsights(ctx(runs, { from: "2026-08-01" }));
    const order = { attention: 0, positive: 1, info: 2 };
    const tones = insights.map((i) => order[i.tone]);
    expect(tones).toEqual([...tones].sort((a, b) => a - b));
    expect(insights.length).toBeLessThanOrEqual(6);
  });
});
