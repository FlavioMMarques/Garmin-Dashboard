import { describe, expect, it } from "vitest";
import type { DayPoint } from "../api/daily";
import type { Night } from "../api/sleep";
import { shiftDate } from "./health";
import {
  bodyBatteryTrendInsight,
  generateTrendInsights,
  hrvTrendInsight,
  restingHrTrendInsight,
  shortNightNextDayInsight,
  sleepWeekdayInsight,
  stepGoalRateInsight,
  stepsTrendInsight,
  stepsWeekdayInsight,
  stressTrendInsight,
  type TrendContext,
} from "./trendInsights";

const LAST = "2026-11-04"; // a Wednesday

function day(date: string, over: Partial<DayPoint> = {}): DayPoint {
  return {
    date,
    hasData: true,
    steps: 9000,
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

function night(date: string, over: Partial<Night> = {}): Night {
  return {
    date,
    hasData: true,
    sleepSeconds: 7.5 * 3600,
    deepSeconds: 3600,
    lightSeconds: 4 * 3600,
    remSeconds: 5400,
    awakeSeconds: 1800,
    napSeconds: 0,
    startLocal: `${date}T00:00`,
    endLocal: `${date}T07:30`,
    score: 80,
    scoreQualifier: "GOOD",
    awakeCount: 1,
    avgSleepStress: 15,
    avgHr: 50,
    avgRespiration: 12,
    avgSpO2: 96,
    sleepNeedMinutes: 480,
    hrvLastNight: 100,
    hrvWeeklyAvg: 100,
    hrvStatus: "BALANCED",
    hrvBalancedLow: 90,
    hrvBalancedUpper: 120,
    ...over,
  };
}

/** `n` days ending at LAST; `d`/`nt` may override by index and date. */
function ctx(
  n: number,
  d: (i: number, date: string) => Partial<DayPoint> = () => ({}),
  nt: (i: number, date: string) => Partial<Night> = () => ({}),
): TrendContext {
  const dates = Array.from({ length: n }, (_, i) => shiftDate(LAST, i - n + 1));
  return {
    days: dates.map((date, i) => day(date, d(i, date))),
    nights: dates.map((date, i) => night(date, nt(i, date))),
  };
}

const lastWeek = (i: number, n: number) => i >= n - 7;
const weekday = (date: string) => new Date(`${date}T12:00Z`).getUTCDay();

describe("restingHrTrendInsight", () => {
  it("flags a last week with resting HR above the period", () => {
    const i = restingHrTrendInsight(ctx(30, (k) => ({ restingHr: lastWeek(k, 30) ? 49 : 45 })));
    expect(i?.tone).toBe("attention");
  });

  it("praises a last week with lower resting HR", () => {
    const i = restingHrTrendInsight(ctx(30, (k) => ({ restingHr: lastWeek(k, 30) ? 42 : 46 })));
    expect(i?.tone).toBe("positive");
  });

  it("stays quiet on a stable resting HR", () => {
    expect(restingHrTrendInsight(ctx(30))).toBeNull();
  });

  it("needs a period of at least three weeks", () => {
    expect(restingHrTrendInsight(ctx(14, (k) => ({ restingHr: k >= 7 ? 55 : 45 })))).toBeNull();
  });
});

describe("hrvTrendInsight", () => {
  it("flags a last week with HRV well below the period", () => {
    const i = hrvTrendInsight(
      ctx(30, undefined, (k) => ({ hrvLastNight: lastWeek(k, 30) ? 85 : 100 })),
    );
    expect(i?.tone).toBe("attention");
  });

  it("praises a last week with higher HRV", () => {
    const i = hrvTrendInsight(
      ctx(30, undefined, (k) => ({ hrvLastNight: lastWeek(k, 30) ? 115 : 100 })),
    );
    expect(i?.tone).toBe("positive");
  });

  it("stays quiet on stable HRV", () => {
    expect(hrvTrendInsight(ctx(30))).toBeNull();
  });
});

describe("stepsTrendInsight", () => {
  it("praises a much more active last week", () => {
    expect(
      stepsTrendInsight(ctx(30, (k) => ({ steps: lastWeek(k, 30) ? 12000 : 8000 })))?.tone,
    ).toBe("positive");
  });

  it("notes a much quieter last week", () => {
    expect(
      stepsTrendInsight(ctx(30, (k) => ({ steps: lastWeek(k, 30) ? 5000 : 9000 })))?.tone,
    ).toBe("info");
  });
});

describe("stressTrendInsight", () => {
  it("flags a more stressful last week", () => {
    expect(
      stressTrendInsight(ctx(30, (k) => ({ stressAvg: lastWeek(k, 30) ? 34 : 25 })))?.tone,
    ).toBe("attention");
  });

  it("stays quiet on stable stress", () => {
    expect(stressTrendInsight(ctx(30))).toBeNull();
  });
});

describe("bodyBatteryTrendInsight", () => {
  it("flags a last week recharging less", () => {
    const i = bodyBatteryTrendInsight(
      ctx(30, (k) => ({ bodyBatteryMax: lastWeek(k, 30) ? 65 : 85 })),
    );
    expect(i?.tone).toBe("attention");
  });

  it("praises a last week recharging more", () => {
    const i = bodyBatteryTrendInsight(
      ctx(30, (k) => ({ bodyBatteryMax: lastWeek(k, 30) ? 95 : 80 })),
    );
    expect(i?.tone).toBe("positive");
  });
});

describe("stepsWeekdayInsight", () => {
  it("names the most and least active weekdays", () => {
    // Saturdays 15k, Sundays 4k, other days 9k.
    const i = stepsWeekdayInsight(
      ctx(35, (_, d) => ({ steps: weekday(d) === 6 ? 15000 : weekday(d) === 0 ? 4000 : 9000 })),
    );
    expect(i?.tone).toBe("info");
    expect(i?.title).toContain("sábado");
    expect(i?.detail).toContain("domingo");
    expect(i?.detail).toContain("aos sábados"); // sábado/domingo are masculine
  });

  it("stays quiet when weekdays look alike", () => {
    expect(stepsWeekdayInsight(ctx(35))).toBeNull();
  });

  it("needs four weeks", () => {
    expect(
      stepsWeekdayInsight(ctx(21, (_, d) => ({ steps: weekday(d) === 6 ? 15000 : 9000 }))),
    ).toBeNull();
  });
});

describe("sleepWeekdayInsight", () => {
  it("names the night of the week with the least sleep", () => {
    // Waking on Monday after short Sunday nights.
    const i = sleepWeekdayInsight(
      ctx(35, undefined, (_, d) => ({ sleepSeconds: weekday(d) === 1 ? 5.5 * 3600 : 7.5 * 3600 })),
    );
    expect(i?.tone).toBe("info");
    expect(i?.title).toContain("domingo para segunda");
  });

  it("stays quiet when nights look alike", () => {
    expect(sleepWeekdayInsight(ctx(35))).toBeNull();
  });
});

describe("stepGoalRateInsight", () => {
  it("praises hitting the step goal on most days", () => {
    const i = stepGoalRateInsight(ctx(30, (k) => ({ steps: k % 5 === 0 ? 8000 : 11000 })));
    expect(i?.tone).toBe("positive");
    expect(i?.title).toContain("24 de 30");
  });

  it("reports a low hit rate as an observation", () => {
    expect(stepGoalRateInsight(ctx(30, (k) => ({ steps: k % 4 === 0 ? 11000 : 8000 })))?.tone).toBe(
      "info",
    );
  });

  it("needs two weeks", () => {
    expect(stepGoalRateInsight(ctx(10))).toBeNull();
  });
});

describe("shortNightNextDayInsight", () => {
  it("shows a lower Body Battery peak and higher resting HR after short nights", () => {
    const short = (k: number) => k % 3 === 0;
    const i = shortNightNextDayInsight(
      ctx(
        30,
        (k) =>
          short(k) ? { bodyBatteryMax: 60, restingHr: 49 } : { bodyBatteryMax: 85, restingHr: 45 },
        (k) => ({ sleepSeconds: short(k) ? 5 * 3600 : 7.5 * 3600 }),
      ),
    );
    expect(i?.tone).toBe("info");
    expect(i?.detail).toMatch(/60.*85/);
    expect(i?.detail).toContain("+4 bpm");
    expect(i?.detail).toContain("depois de noites de 7 h ou mais (20 dias), em 85");
  });

  it("stays quiet without enough short and good nights", () => {
    const i = shortNightNextDayInsight(
      ctx(30, undefined, (k) => ({ sleepSeconds: k < 2 ? 5 * 3600 : 7.5 * 3600 })),
    );
    expect(i).toBeNull();
  });
});

describe("generateTrendInsights", () => {
  it("returns nothing without data", () => {
    const empty = ctx(
      30,
      () => ({ hasData: false }),
      () => ({ hasData: false }),
    );
    expect(generateTrendInsights(empty)).toEqual([]);
  });

  it("orders attention first, then positive, then info", () => {
    const c = ctx(35, (k) => ({
      restingHr: lastWeek(k, 35) ? 50 : 45,
      steps: lastWeek(k, 35) ? 13000 : 8000,
    }));
    const order = (t: string) => ["attention", "positive", "info"].indexOf(t);
    const tones = generateTrendInsights(c).map((i) => order(i.tone));
    expect(tones).toEqual([...tones].sort((a, b) => a - b));
  });
});
