import { describe, expect, it } from "vitest";
import { mkRun, runSeries } from "../test/runs";
import {
  anaerobicInsight,
  bestMonthInsight,
  elevationInsight,
  frequencyInsight,
  hardSpacingInsight,
  longRunInsight,
  timeOfDayInsight,
  treadmillInsight,
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
const pace = (secPerKm: number) => ({ avgSpeedMps: 1000 / secPerKm });

describe("timeOfDayInsight", () => {
  it("compares morning and evening pace", () => {
    const morning = runSeries(
      4,
      "2026-09-01",
      2,
      () => pace(340),
      () => "06:30:00",
    );
    const evening = runSeries(
      4,
      "2026-09-02",
      2,
      () => pace(355),
      () => "19:00:00",
    );
    const insight = timeOfDayInsight(ctx([...morning, ...evening]))!;
    expect(insight.title).toMatch(/manhã/);
    expect(insight.detail).toMatch(/15 s\/km/);
  });

  it("stays quiet without enough runs in both slots", () => {
    const morning = runSeries(
      4,
      "2026-09-01",
      2,
      () => pace(340),
      () => "06:30:00",
    );
    expect(timeOfDayInsight(ctx(morning))).toBeNull();
  });
});

describe("treadmillInsight", () => {
  it("compares treadmill and outdoor pace", () => {
    const tread = runSeries(3, "2026-09-01", 2, () => ({
      type: "treadmill_running",
      ...pace(320),
    }));
    const road = runSeries(3, "2026-09-02", 2, () => pace(345));
    expect(treadmillInsight(ctx([...tread, ...road]))!.detail).toMatch(
      /25 s\/km mais rápido na esteira/,
    );
  });

  it("stays quiet with fewer than three runs of each", () => {
    const tread = runSeries(2, "2026-09-01", 2, () => ({
      type: "treadmill_running",
      ...pace(320),
    }));
    const road = runSeries(5, "2026-09-02", 2, () => pace(345));
    expect(treadmillInsight(ctx([...tread, ...road]))).toBeNull();
  });
});

describe("longRunInsight", () => {
  it("reports a growing long run", () => {
    // weekly: one 4 km + one long run; long run 8 km for 4 weeks, then 12 km for 4 weeks
    const runs = runSeries(16, "2026-09-07", 3.5, (i) => ({
      distanceM: i % 2 === 0 ? 4000 : i < 8 ? 8000 : 12000,
    }));
    const insight = longRunInsight(ctx(runs))!;
    expect(insight.tone).toBe("positive");
    expect(insight.detail).toMatch(/8,0 km.*12,0 km/);
  });

  it("stays quiet when the long run is stable and balanced", () => {
    const runs = runSeries(24, "2026-09-07", 7 / 3, (i) => ({
      distanceM: i % 3 === 0 ? 8000 : 6000,
    }));
    expect(longRunInsight(ctx(runs))).toBeNull();
  });
});

describe("hardSpacingInsight", () => {
  it("flags hard sessions on back-to-back days", () => {
    const runs = [
      mkRun(1, "2026-10-01", { trainingLabel: "TEMPO" }),
      mkRun(2, "2026-10-02", { trainingLabel: "VO2MAX" }),
      mkRun(3, "2026-10-10", { trainingLabel: "LACTATE_THRESHOLD" }),
      mkRun(4, "2026-10-11", { trainingLabel: "TEMPO" }),
    ];
    const insight = hardSpacingInsight(ctx(runs))!;
    expect(insight.tone).toBe("attention");
    expect(insight.detail).toMatch(/2 vezes/);
  });

  it("stays quiet when hard days are separated", () => {
    const runs = [
      mkRun(1, "2026-10-01", { trainingLabel: "TEMPO" }),
      mkRun(2, "2026-10-02", { trainingLabel: "RECOVERY" }),
      mkRun(3, "2026-10-03", { trainingLabel: "TEMPO" }),
    ];
    expect(hardSpacingInsight(ctx(runs))).toBeNull();
  });
});

describe("anaerobicInsight", () => {
  it("notes the absence of anaerobic stimulus", () => {
    const runs = runSeries(12, "2026-09-01", 3, () => ({ anaerobicTe: 0, aerobicTe: 3.5 }));
    expect(anaerobicInsight(ctx(runs))!.title).toMatch(/anaeróbico/);
  });

  it("stays quiet when some runs had anaerobic effect", () => {
    const runs = runSeries(12, "2026-09-01", 3, (i) => ({ anaerobicTe: i % 4 === 0 ? 2.1 : 0 }));
    expect(anaerobicInsight(ctx(runs))).toBeNull();
  });
});

describe("elevationInsight", () => {
  it("notes when almost every run is flat", () => {
    const runs = runSeries(12, "2026-09-01", 3, () => ({ elevationGainM: 8 }));
    expect(elevationInsight(ctx(runs))!.detail).toMatch(/12 de 12/);
  });

  it("stays quiet with hilly runs in the mix", () => {
    const runs = runSeries(12, "2026-09-01", 3, (i) => ({
      elevationGainM: i % 3 === 0 ? 120 : 10,
    }));
    expect(elevationInsight(ctx(runs))).toBeNull();
  });
});

describe("bestMonthInsight", () => {
  it("highlights the biggest month, positive when it is recent", () => {
    const runs = [
      ...runSeries(4, "2026-08-03", 7),
      ...runSeries(10, "2026-10-01", 3, () => ({ distanceM: 8000 })),
    ];
    const insight = bestMonthInsight(ctx(runs))!;
    expect(insight.tone).toBe("positive");
    expect(insight.title).toMatch(/outubro/);
    expect(insight.detail).toMatch(/80,0 km/);
  });

  it("stays quiet with fewer than three months of runs", () => {
    expect(bestMonthInsight(ctx(runSeries(6, "2026-10-01", 3)))).toBeNull();
  });
});

describe("frequencyInsight", () => {
  it("praises running four or more times a week", () => {
    const runs = runSeries(40, "2026-09-07", 1.5);
    expect(frequencyInsight(ctx(runs))!.tone).toBe("positive");
  });

  it("notes a low weekly frequency", () => {
    const runs = runSeries(8, "2026-08-03", 10);
    expect(frequencyInsight(ctx(runs))!.detail).toMatch(/0,\d vez/);
  });

  it("stays quiet in the 2–4 runs per week range", () => {
    expect(frequencyInsight(ctx(runSeries(24, "2026-09-07", 2.5)))).toBeNull();
  });
});
