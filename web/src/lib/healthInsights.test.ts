import { describe, expect, it } from "vitest";
import { daySeries, mkNight } from "../test/health";
import { baseline, dailyInsights } from "./healthInsights";

const DATE = "2026-11-05";
const find = (days: ReturnType<typeof daySeries>, id: string) =>
  dailyInsights(days, DATE).find((i) => i.id === id);

describe("baseline", () => {
  it("is the median of the 30 days before the date, ignoring missing values", () => {
    const days = daySeries(31, DATE, (i) => ({ restingHr: i === 30 ? 60 : i % 2 ? 44 : null }));
    expect(baseline(days, DATE, (d) => d.restingHr)).toBe(44);
  });
});

describe("dailyInsights", () => {
  it("flags a resting HR well above the usual", () => {
    const days = daySeries(31, DATE, (i) => ({ restingHr: i === 30 ? 52 : 45 }));
    const insight = find(days, "rhr")!;
    expect(insight.tone).toBe("attention");
    expect(insight.detail).toMatch(/52 bpm.*45 bpm/);
  });

  it("flags a short night and praises a long good one", () => {
    const short = daySeries(31, DATE, (i) =>
      i === 30 ? { sleep: mkNight({ totalS: 5 * 3600 }) } : {},
    );
    expect(find(short, "sleep")!.tone).toBe("attention");
    const good = daySeries(31, DATE, (i) =>
      i === 30 ? { sleep: mkNight({ totalS: 8 * 3600, score: 88 }) } : {},
    );
    expect(find(good, "sleep")!.tone).toBe("positive");
  });

  it("flags HRV clearly below the weekly average", () => {
    const days = daySeries(31, DATE, (i) =>
      i === 30 ? { hrv: { lastNightAvg: 45, weeklyAvg: 60, status: "UNBALANCED" } } : {},
    );
    expect(find(days, "hrv")!.tone).toBe("attention");
  });

  it("notes a low Body Battery peak", () => {
    const days = daySeries(31, DATE, (i) => (i === 30 ? { bodyBatteryMax: 42 } : {}));
    expect(find(days, "body-battery")!.detail).toMatch(/42/);
  });

  it("celebrates reaching the step goal", () => {
    const days = daySeries(31, DATE, (i) => (i === 30 ? { steps: 12000, stepsGoal: 9000 } : {}));
    expect(find(days, "steps")!.tone).toBe("positive");
  });

  it("combines sleep, HRV, Body Battery and resting HR into readiness", () => {
    const tired = daySeries(31, DATE, (i) =>
      i === 30
        ? {
            restingHr: 52,
            bodyBatteryMax: 40,
            sleep: mkNight({ totalS: 5 * 3600, score: 55 }),
            hrv: { lastNightAvg: 45, weeklyAvg: 60, status: "UNBALANCED" },
          }
        : {},
    );
    const r1 = find(tired, "readiness")!;
    expect(r1.tone).toBe("attention");
    expect(r1.title).toMatch(/leve/i);

    const fresh = daySeries(31, DATE, (i) =>
      i === 30
        ? {
            bodyBatteryMax: 92,
            sleep: mkNight({ totalS: 8 * 3600, score: 88 }),
            hrv: { lastNightAvg: 66, weeklyAvg: 60, status: "BALANCED" },
          }
        : {},
    );
    expect(find(fresh, "readiness")!.tone).toBe("positive");
  });

  it("does not judge movement on a day still in progress", () => {
    const days = daySeries(31, DATE, (i) => (i === 30 ? { steps: 2000, stepsGoal: 9000 } : {}));
    expect(dailyInsights(days, DATE).map((i) => i.id)).toContain("steps");
    expect(dailyInsights(days, DATE, { inProgress: true }).map((i) => i.id)).not.toContain("steps");
  });

  it("stays quiet on an ordinary day", () => {
    const days = daySeries(31, DATE);
    const ids = dailyInsights(days, DATE).map((i) => i.id);
    expect(ids).not.toContain("rhr");
    expect(ids).not.toContain("hrv");
    expect(ids).not.toContain("body-battery");
  });

  it("returns nothing for a date without data", () => {
    expect(dailyInsights(daySeries(5, "2026-10-01"), DATE)).toEqual([]);
  });
});
