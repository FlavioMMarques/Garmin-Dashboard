import { describe, expect, it } from "vitest";
import type { Night } from "../api/sleep";
import { shiftDate } from "./health";
import {
  bedtimeRegularityInsight,
  bedtimeScoreInsight,
  generateSleepInsights,
  hrvInsight,
  missingNightsInsight,
  phasesInsight,
  recentTrendInsight,
  shortNightsInsight,
  sleepNeedInsight,
  weekendShiftInsight,
} from "./sleepInsights";

const LAST = "2026-11-04"; // a Wednesday
const H = 3600;

function night(date: string, over: Partial<Night> = {}): Night {
  return {
    date,
    hasData: true,
    sleepSeconds: 7.5 * H,
    deepSeconds: 1.2 * H,
    lightSeconds: 4.3 * H,
    remSeconds: 1.75 * H,
    awakeSeconds: 0.25 * H,
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

/** `n` nights ending at LAST, oldest first; `over` may depend on the index. */
function nights(n: number, over: (i: number, date: string) => Partial<Night> = () => ({})) {
  return Array.from({ length: n }, (_, i) => {
    const date = shiftDate(LAST, i - n + 1);
    return night(date, over(i, date));
  });
}

/** "HH:MM" bedtime on the evening before `date` (or after midnight on `date`). */
const bed = (date: string, hhmm: string) =>
  hhmm >= "12:00" ? `${shiftDate(date, -1)}T${hhmm}` : `${date}T${hhmm}`;

describe("sleepNeedInsight", () => {
  it("flags sleeping well under Garmin's sleep need", () => {
    const i = sleepNeedInsight({ nights: nights(10, () => ({ sleepSeconds: 6.5 * H })) });
    expect(i?.tone).toBe("attention");
    expect(i?.title).toContain("1 h 30 min");
  });

  it("praises meeting the sleep need", () => {
    expect(sleepNeedInsight({ nights: nights(10, () => ({ sleepSeconds: 8.2 * H })) })?.tone).toBe(
      "positive",
    );
  });

  it("needs at least five nights", () => {
    expect(sleepNeedInsight({ nights: nights(4, () => ({ sleepSeconds: 5 * H })) })).toBeNull();
  });
});

describe("shortNightsInsight", () => {
  it("flags many nights under six hours", () => {
    const i = shortNightsInsight({
      nights: nights(10, (k) => ({ sleepSeconds: k < 4 ? 5 * H : 7.5 * H })),
    });
    expect(i?.tone).toBe("attention");
    expect(i?.title).toContain("4 de 10");
  });

  it("stays quiet when short nights are rare", () => {
    const list = nights(10, (k) => ({ sleepSeconds: k < 2 ? 5 * H : 7.5 * H }));
    expect(shortNightsInsight({ nights: list })).toBeNull();
  });
});

describe("bedtimeRegularityInsight", () => {
  it("flags bedtimes that vary a lot", () => {
    const times = ["22:00", "01:30", "23:00", "02:00", "22:30", "01:00", "23:30", "02:30"];
    const list = nights(8, (k, d) => ({ startLocal: bed(d, times[k]!) }));
    expect(bedtimeRegularityInsight({ nights: list })?.tone).toBe("attention");
  });

  it("praises a regular bedtime, even across midnight", () => {
    const times = ["23:50", "00:10", "23:45", "00:05", "00:00", "23:55", "00:15", "00:00"];
    const list = nights(8, (k, d) => ({ startLocal: bed(d, times[k]!) }));
    expect(bedtimeRegularityInsight({ nights: list })?.tone).toBe("positive");
  });

  it("is not thrown off by a single daytime sleep", () => {
    const times = ["23:50", "00:10", "13:08", "00:05", "00:00", "23:55", "00:15", "00:00"];
    const list = nights(8, (k, d) => ({ startLocal: bed(d, times[k]!) }));
    expect(bedtimeRegularityInsight({ nights: list })?.tone).toBe("positive");
  });

  it("needs a week of nights", () => {
    expect(bedtimeRegularityInsight({ nights: nights(6) })).toBeNull();
  });
});

describe("weekendShiftInsight", () => {
  it("notes going to bed much later before weekend days", () => {
    // Waking on Saturday or Sunday (getUTCDay 6 / 0) means the Friday/Saturday night.
    const list = nights(14, (_, d) => {
      const dow = new Date(`${d}T12:00Z`).getUTCDay();
      return { startLocal: bed(d, dow === 6 || dow === 0 ? "02:00" : "23:30") };
    });
    const i = weekendShiftInsight({ nights: list });
    expect(i?.tone).toBe("info");
    expect(i?.detail).toContain("2 h 30 min");
  });

  it("stays quiet when weekend bedtimes match the week", () => {
    expect(weekendShiftInsight({ nights: nights(14) })).toBeNull();
  });
});

describe("phasesInsight", () => {
  it("notes REM below the common reference", () => {
    const list = nights(10, () => ({ remSeconds: 0.8 * H, lightSeconds: 5.25 * H }));
    const i = phasesInsight({ nights: list });
    expect(i?.tone).toBe("info");
    expect(i?.title).toContain("REM");
  });

  it("praises phases within the references", () => {
    expect(phasesInsight({ nights: nights(10) })?.tone).toBe("positive");
  });
});

describe("hrvInsight", () => {
  it("flags a recent week below the balanced range", () => {
    const list = nights(14, (k) => ({ hrvLastNight: k >= 7 ? 80 : 100 }));
    expect(hrvInsight({ nights: list })?.tone).toBe("attention");
  });

  it("praises a recent week inside the balanced range", () => {
    expect(hrvInsight({ nights: nights(14) })?.tone).toBe("positive");
  });

  it("needs HRV on at least five recent nights", () => {
    const list = nights(14, (k) => ({ hrvLastNight: k >= 10 ? 80 : null }));
    expect(hrvInsight({ nights: list })).toBeNull();
  });
});

describe("recentTrendInsight", () => {
  it("flags a last week much shorter than the rest of the period", () => {
    const list = nights(30, (k) => ({ sleepSeconds: k >= 23 ? 6.2 * H : 7.5 * H }));
    expect(recentTrendInsight({ nights: list })?.tone).toBe("attention");
  });

  it("praises a last week with more sleep", () => {
    const list = nights(30, (k) => ({ sleepSeconds: k >= 23 ? 8.3 * H : 7.3 * H }));
    expect(recentTrendInsight({ nights: list })?.tone).toBe("positive");
  });

  it("needs a period longer than two weeks", () => {
    const list = nights(10, (k) => ({ sleepSeconds: k >= 3 ? 5 * H : 8 * H }));
    expect(recentTrendInsight({ nights: list })).toBeNull();
  });
});

describe("bedtimeScoreInsight", () => {
  it("shows that earlier bedtimes come with better scores", () => {
    const list = nights(12, (k, d) =>
      k % 2 === 0
        ? { startLocal: bed(d, "23:00"), score: 85 }
        : { startLocal: bed(d, "01:30"), score: 65 },
    );
    const i = bedtimeScoreInsight({ nights: list });
    expect(i?.tone).toBe("info");
    expect(i?.detail).toMatch(/85.*65/);
  });

  it("stays quiet when bedtime makes no difference", () => {
    const list = nights(12, (k, d) => ({ startLocal: bed(d, k % 2 ? "23:00" : "01:30") }));
    expect(bedtimeScoreInsight({ nights: list })).toBeNull();
  });
});

describe("missingNightsInsight", () => {
  it("notes many nights without a record", () => {
    const list = nights(10, (k) => (k < 3 ? { hasData: false, sleepSeconds: null } : {}));
    expect(missingNightsInsight({ nights: list })?.title).toContain("3 de 10");
  });

  it("stays quiet when almost every night is recorded", () => {
    const list = nights(10, (k) => (k < 1 ? { hasData: false, sleepSeconds: null } : {}));
    expect(missingNightsInsight({ nights: list })).toBeNull();
  });
});

describe("generateSleepInsights", () => {
  it("returns nothing without recorded nights", () => {
    const list = nights(10, () => ({ hasData: false, sleepSeconds: null }));
    expect(generateSleepInsights({ nights: list })).toEqual([]);
  });

  it("orders attention first, then positive, then info", () => {
    const list = nights(30, (k) => ({ sleepSeconds: k >= 23 ? 5 * H : 7.5 * H }));
    const order = (t: string) => ["attention", "positive", "info"].indexOf(t);
    const tones = generateSleepInsights({ nights: list }).map((i) => order(i.tone));
    expect(tones).toEqual([...tones].sort((a, b) => a - b));
  });
});
