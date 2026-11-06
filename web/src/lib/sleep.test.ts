import { describe, expect, it } from "vitest";
import type { Night } from "../api/sleep";
import { averageClock, formatClock, summarizeNights } from "./sleep";

function night(date: string, over: Partial<Night> = {}): Night {
  return {
    date,
    hasData: true,
    sleepSeconds: 7 * 3600,
    deepSeconds: 3600,
    lightSeconds: 4 * 3600,
    remSeconds: 5400,
    awakeSeconds: 1800,
    napSeconds: 0,
    startLocal: `${date}T00:00`,
    endLocal: `${date}T07:00`,
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

describe("averageClock", () => {
  it("averages bedtimes across midnight", () => {
    expect(averageClock(["2026-11-01T23:30", "2026-11-03T00:30"])).toBe(0);
  });

  it("averages ordinary wake times", () => {
    expect(averageClock(["2026-11-01T06:30", "2026-11-02T07:30"])).toBe(7 * 60);
  });

  it("is null without times", () => {
    expect(averageClock([])).toBeNull();
  });
});

describe("formatClock", () => {
  it("formats minutes after midnight as HH:MM", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(23 * 60 + 5)).toBe("23:05");
  });
});

describe("summarizeNights", () => {
  it("averages only the nights with data", () => {
    const s = summarizeNights([
      night("2026-11-01", { sleepSeconds: 6 * 3600, score: 70, hrvLastNight: 90 }),
      night("2026-11-02", { sleepSeconds: 8 * 3600, score: 90, hrvLastNight: 110 }),
      { ...night("2026-11-03"), hasData: false, sleepSeconds: null, score: null },
    ]);
    expect(s).toMatchObject({
      nights: 2,
      avgSleepSeconds: 7 * 3600,
      avgScore: 80,
      avgHrv: 100,
      avgNeedMinutes: 480,
      avgBedtime: 0,
      avgWake: 7 * 60,
    });
  });

  it("returns nulls when no night has data", () => {
    const s = summarizeNights([{ ...night("2026-11-01"), hasData: false }]);
    expect(s).toMatchObject({ nights: 0, avgSleepSeconds: null, avgBedtime: null });
  });
});
