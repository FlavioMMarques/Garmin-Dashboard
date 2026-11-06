import { describe, expect, it } from "vitest";
import type { DayPoint } from "../api/daily";
import type { RunSummary } from "../api/runs";
import type { Night } from "../api/sleep";
import { mkRun } from "../test/runs";
import {
  bodyBatteryRunInsight,
  generateCrossInsights,
  hardRunNextNightInsight,
  hrvBeforeRunInsight,
  lateRunSleepInsight,
  restingHrRunInsight,
  sleepBeforeRunInsight,
  type CrossContext,
} from "./crossInsights";
import { shiftDate } from "./health";

const LAST = "2026-11-04";
const H = 3600;

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
    sleepSeconds: 6.5 * H,
    deepSeconds: H,
    lightSeconds: 4 * H,
    remSeconds: 1.25 * H,
    awakeSeconds: 0.25 * H,
    napSeconds: 0,
    startLocal: `${date}T00:00`,
    endLocal: `${date}T06:30`,
    score: 75,
    scoreQualifier: "FAIR",
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

/** One run a day for `n` days ending at LAST, with matching days and nights. */
function ctx(
  n: number,
  o: {
    run?: (i: number) => Partial<RunSummary>;
    time?: (i: number) => string;
    day?: (i: number) => Partial<DayPoint>;
    night?: (i: number) => Partial<Night>;
  } = {},
): CrossContext {
  const dates = Array.from({ length: n }, (_, i) => shiftDate(LAST, i - n + 1));
  return {
    runs: dates.map((d, i) => mkRun(i + 1, d, o.run?.(i), o.time?.(i))),
    days: dates.map((d, i) => day(d, o.day?.(i))),
    nights: dates.map((d, i) => night(d, o.night?.(i))),
  };
}

// Default run: 5:50 /km at 155 bpm ≈ 1,11 m per beat; at 145 bpm ≈ 1,18 (+7%).
const efficient = { avgHr: 145 };

describe("sleepBeforeRunInsight", () => {
  it("compares efficiency after good and short nights", () => {
    const good = (i: number) => i % 2 === 0;
    const i = sleepBeforeRunInsight(
      ctx(20, {
        night: (k) => ({ sleepSeconds: good(k) ? 7.5 * H : 5 * H }),
        run: (k) => (good(k) ? efficient : {}),
      }),
    );
    expect(i?.tone).toBe("info");
    expect(i?.title).toContain("noites de 7 h ou mais");
    expect(i?.detail).toMatch(/1,18.*1,11/);
  });

  it("stays quiet when sleep makes no difference", () => {
    const i = sleepBeforeRunInsight(
      ctx(20, { night: (k) => ({ sleepSeconds: k % 2 ? 7.5 * H : 5 * H }) }),
    );
    expect(i).toBeNull();
  });

  it("needs at least four runs in each group", () => {
    const i = sleepBeforeRunInsight(
      ctx(20, {
        night: (k) => ({ sleepSeconds: k < 3 ? 5 * H : 7.5 * H }),
        run: (k) => (k < 3 ? {} : efficient),
      }),
    );
    expect(i).toBeNull();
  });
});

describe("hrvBeforeRunInsight", () => {
  it("compares efficiency after low and balanced HRV nights", () => {
    const low = (i: number) => i % 3 === 0;
    const i = hrvBeforeRunInsight(
      ctx(24, {
        night: (k) => ({ hrvLastNight: low(k) ? 80 : 100 }),
        run: (k) => (low(k) ? {} : efficient),
      }),
    );
    expect(i?.tone).toBe("info");
    expect(i?.title).toContain("VFC");
  });

  it("stays quiet without low-HRV nights", () => {
    expect(hrvBeforeRunInsight(ctx(24, { run: (k) => (k % 2 ? efficient : {}) }))).toBeNull();
  });
});

describe("bodyBatteryRunInsight", () => {
  it("compares efficiency on low and high Body Battery days", () => {
    const high = (i: number) => i % 2 === 0;
    const i = bodyBatteryRunInsight(
      ctx(20, {
        day: (k) => ({ bodyBatteryMax: high(k) ? 92 : 60 }),
        run: (k) => (high(k) ? efficient : {}),
      }),
    );
    expect(i?.tone).toBe("info");
    expect(i?.detail).toContain("Body Battery");
  });

  it("stays quiet when Body Battery makes no difference", () => {
    expect(
      bodyBatteryRunInsight(ctx(20, { day: (k) => ({ bodyBatteryMax: k % 2 ? 92 : 60 }) })),
    ).toBeNull();
  });
});

describe("restingHrRunInsight", () => {
  it("compares efficiency on days with elevated resting HR", () => {
    const elevated = (i: number) => i % 4 === 0;
    const i = restingHrRunInsight(
      ctx(24, {
        day: (k) => ({ restingHr: elevated(k) ? 50 : 45 }),
        run: (k) => (elevated(k) ? {} : efficient),
      }),
    );
    expect(i?.tone).toBe("info");
    expect(i?.title).toContain("FC em repouso");
  });

  it("stays quiet without elevated days", () => {
    expect(restingHrRunInsight(ctx(24, { run: (k) => (k % 2 ? efficient : {}) }))).toBeNull();
  });
});

describe("hardRunNextNightInsight", () => {
  it("shows a lower HRV the night after hard runs", () => {
    // Hard runs on even days; the night after (odd index) has lower HRV.
    const i = hardRunNextNightInsight(
      ctx(20, {
        run: (k) => ({ aerobicTe: k % 2 === 0 ? 4.0 : 2.5 }),
        night: (k) => ({ hrvLastNight: k % 2 === 1 ? 88 : 100 }),
      }),
    );
    expect(i?.tone).toBe("info");
    expect(i?.detail).toMatch(/88.*100/);
  });

  it("stays quiet when the next night looks the same", () => {
    expect(
      hardRunNextNightInsight(ctx(20, { run: (k) => ({ aerobicTe: k % 2 === 0 ? 4.0 : 2.5 }) })),
    ).toBeNull();
  });
});

describe("lateRunSleepInsight", () => {
  it("shows a worse night after evening runs", () => {
    const late = (i: number) => i % 3 === 0;
    const i = lateRunSleepInsight(
      ctx(24, {
        time: (k) => (late(k) ? "20:00:00" : "07:00:00"),
        // The night after day k is stored under day k + 1.
        night: (k) => ({ score: late(k - 1) ? 65 : 80 }),
      }),
    );
    expect(i?.tone).toBe("info");
    expect(i?.detail).toMatch(/65.*80/);
  });

  it("stays quiet without evening runs", () => {
    expect(lateRunSleepInsight(ctx(24))).toBeNull();
  });
});

describe("generateCrossInsights", () => {
  it("returns nothing without runs", () => {
    expect(generateCrossInsights({ runs: [], days: [], nights: [] })).toEqual([]);
  });
});
