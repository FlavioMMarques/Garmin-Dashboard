import { describe, expect, it } from "vitest";
import type { DayPoint } from "../api/daily";
import {
  bodyBatteryBalanceInsight,
  bodyBatteryPeakInsight,
  generateHealthInsights,
  highStressInsight,
  intensityWeekInsight,
  restingHrInsight,
  stepStreakInsight,
  stepsGoalInsight,
  stepsVsUsualInsight,
  stressInsight,
  type HealthContext,
} from "./healthInsights";
import { shiftDate } from "./health";

const DAY = "2026-11-04"; // a Wednesday

function point(date: string, over: Partial<DayPoint> = {}): DayPoint {
  return {
    date,
    hasData: true,
    steps: 8000,
    stepGoal: 10000,
    restingHr: 45,
    stressAvg: 25,
    stressHighShare: 0.02,
    bodyBatteryMin: 20,
    bodyBatteryMax: 80,
    bodyBatteryCharged: 60,
    bodyBatteryDrained: 60,
    intensityModerate: 0,
    intensityVigorous: 0,
    intensityGoal: 150,
    caloriesActive: 300,
    ...over,
  };
}

/** `n` typical days right before DAY, oldest first. */
function history(n = 30, over: Partial<DayPoint> = {}): DayPoint[] {
  return Array.from({ length: n }, (_, i) => point(shiftDate(DAY, i - n), over));
}

function ctx(day: Partial<DayPoint>, hist = history(), extra: Partial<HealthContext> = {}) {
  return { day: point(DAY, day), history: hist, today: "2026-11-05", weekStartsOn: 1, ...extra };
}

describe("restingHrInsight", () => {
  it("flags a resting HR well above the usual", () => {
    const i = restingHrInsight(ctx({ restingHr: 50 }));
    expect(i).toMatchObject({ tone: "attention" });
    expect(i?.detail).toContain("+5 bpm");
  });

  it("praises a resting HR below the usual", () => {
    expect(restingHrInsight(ctx({ restingHr: 41 }))?.tone).toBe("positive");
  });

  it("notes a resting HR within the usual range", () => {
    expect(restingHrInsight(ctx({ restingHr: 46 }))?.tone).toBe("info");
  });

  it("needs a week of history", () => {
    expect(restingHrInsight(ctx({ restingHr: 50 }, history(6)))).toBeNull();
  });
});

describe("bodyBatteryPeakInsight", () => {
  it("flags a peak far below the usual", () => {
    expect(bodyBatteryPeakInsight(ctx({ bodyBatteryMax: 60 }))?.tone).toBe("attention");
  });

  it("praises a peak above the usual", () => {
    expect(bodyBatteryPeakInsight(ctx({ bodyBatteryMax: 95 }))?.tone).toBe("positive");
  });

  it("stays quiet near the usual peak", () => {
    expect(bodyBatteryPeakInsight(ctx({ bodyBatteryMax: 75 }))).toBeNull();
  });
});

describe("bodyBatteryBalanceInsight", () => {
  it("flags a finished day that drained much more than it charged", () => {
    const i = bodyBatteryBalanceInsight(ctx({ bodyBatteryCharged: 40, bodyBatteryDrained: 80 }));
    expect(i?.tone).toBe("attention");
  });

  it("praises a day that recharged more than it drained", () => {
    const i = bodyBatteryBalanceInsight(ctx({ bodyBatteryCharged: 80, bodyBatteryDrained: 50 }));
    expect(i?.tone).toBe("positive");
  });

  it("waits for the day to end", () => {
    const today = ctx({ bodyBatteryCharged: 40, bodyBatteryDrained: 80 }, history(), {
      today: DAY,
    });
    expect(bodyBatteryBalanceInsight(today)).toBeNull();
  });
});

describe("stressInsight", () => {
  it("flags stress well above the usual", () => {
    expect(stressInsight(ctx({ stressAvg: 35 }))?.tone).toBe("attention");
  });

  it("praises a calmer day than usual", () => {
    expect(stressInsight(ctx({ stressAvg: 15 }))?.tone).toBe("positive");
  });

  it("stays quiet near the usual", () => {
    expect(stressInsight(ctx({ stressAvg: 28 }))).toBeNull();
  });
});

describe("highStressInsight", () => {
  it("flags much more time in high stress than usual", () => {
    const i = highStressInsight(ctx({ stressHighShare: 0.12 }));
    expect(i?.tone).toBe("attention");
    expect(i?.detail).toContain("12%");
  });

  it("ignores small shares even if above the usual", () => {
    expect(highStressInsight(ctx({ stressHighShare: 0.06 }))).toBeNull();
  });
});

describe("stepsGoalInsight", () => {
  it("praises hitting the step goal", () => {
    expect(stepsGoalInsight(ctx({ steps: 10500 }))?.tone).toBe("positive");
  });

  it("reports how close a finished day came", () => {
    const i = stepsGoalInsight(ctx({ steps: 7500 }));
    expect(i?.tone).toBe("info");
    expect(i?.detail).toContain("75%");
  });

  it("does not judge today before it ends", () => {
    expect(stepsGoalInsight(ctx({ steps: 3000 }, history(), { today: DAY }))).toBeNull();
  });
});

describe("stepsVsUsualInsight", () => {
  it("praises a much more active day", () => {
    expect(stepsVsUsualInsight(ctx({ steps: 14000 }))?.tone).toBe("positive");
  });

  it("notes a much quieter finished day", () => {
    expect(stepsVsUsualInsight(ctx({ steps: 3000 }))?.tone).toBe("info");
  });

  it("stays quiet on a typical day", () => {
    expect(stepsVsUsualInsight(ctx({ steps: 9000 }))).toBeNull();
  });
});

describe("stepStreakInsight", () => {
  it("counts consecutive days hitting the goal", () => {
    const hist = [
      ...history(27),
      ...history(3, { steps: 12000 }).map((d, i) => ({
        ...d,
        date: shiftDate(DAY, i - 3),
      })),
    ];
    const i = stepStreakInsight(ctx({ steps: 11000 }, hist));
    expect(i?.tone).toBe("positive");
    expect(i?.title).toContain("4 dias");
  });

  it("needs at least three days", () => {
    const hist = [...history(29), point(shiftDate(DAY, -1), { steps: 12000 })];
    expect(stepStreakInsight(ctx({ steps: 11000 }, hist))).toBeNull();
  });
});

describe("intensityWeekInsight", () => {
  it("adds the week so far, vigorous minutes counted double", () => {
    // Week starts Monday 2026-11-02: Mon 20 mod, Tue 10 vig, Wed 30 mod → 70 of 150.
    const hist = [
      ...history(28),
      point("2026-11-02", { intensityModerate: 20 }),
      point("2026-11-03", { intensityVigorous: 10 }),
    ];
    const i = intensityWeekInsight(ctx({ intensityModerate: 30 }, hist));
    expect(i?.tone).toBe("info");
    expect(i?.detail).toContain("70 de 150");
  });

  it("praises reaching the weekly goal", () => {
    const hist = [...history(29), point("2026-11-03", { intensityVigorous: 60 })];
    expect(intensityWeekInsight(ctx({ intensityModerate: 40 }, hist))?.tone).toBe("positive");
  });

  it("follows the user's first day of the week", () => {
    // Sunday start: the week also includes Sun 2026-11-01.
    const hist = [...history(29), point("2026-11-01", { intensityModerate: 150 })];
    expect(intensityWeekInsight(ctx({}, hist, { weekStartsOn: 0 }))?.tone).toBe("positive");
    expect(intensityWeekInsight(ctx({}, hist, { weekStartsOn: 1 }))?.tone).toBe("info");
  });
});

describe("generateHealthInsights", () => {
  it("returns nothing for a day without data", () => {
    expect(generateHealthInsights(ctx({ hasData: false }))).toEqual([]);
  });

  it("ignores history days without data when building the baseline", () => {
    const hist = [...history(6), ...history(10, { hasData: false, restingHr: 70 })];
    expect(restingHrInsight(ctx({ restingHr: 50 }, hist))).toBeNull();
  });

  it("orders attention first, then positive, then info", () => {
    const tones = generateHealthInsights(ctx({ restingHr: 50, steps: 14000 })).map((i) => i.tone);
    expect(tones).toEqual([...tones].sort((a, b) => order(a) - order(b)));
  });
});

const order = (t: string) => ["attention", "positive", "info"].indexOf(t);
