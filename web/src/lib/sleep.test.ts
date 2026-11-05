import { describe, expect, it } from "vitest";
import { daySeries, mkNight } from "../test/health";
import { bedtimeMinutes, sleepInsights, sleepStats } from "./sleep";

const LAST = "2026-11-05";
const at = (hhmm: string, day = "2026-11-01") => `${day}T${hhmm}`;

describe("bedtimeMinutes", () => {
  it("counts minutes after 18:00 so midnight crossings stay continuous", () => {
    expect(bedtimeMinutes(at("23:30"))).toBe(330);
    expect(bedtimeMinutes(at("01:15"))).toBe(435);
    expect(bedtimeMinutes(null)).toBeNull();
  });
});

describe("sleepStats", () => {
  it("summarizes the nights with data", () => {
    const days = daySeries(4, LAST, (i) => ({
      sleep:
        i === 3
          ? null
          : mkNight({
              totalS: [6, 7, 8][i]! * 3600,
              score: [70, 80, 90][i]!,
              deepS: 3600,
              remS: 1.5 * 3600,
              startLocal: at(["23:00", "23:30", "00:00"][i]!),
            }),
    }));
    expect(sleepStats(days)).toEqual({
      nights: 3,
      avgTotalS: 7 * 3600,
      avgScore: 80,
      shareAtLeast7h: 2 / 3,
      avgBedtime: "23:30",
      deepShare: 3600 / (7 * 3600),
      remShare: (1.5 * 3600) / (7 * 3600),
    });
  });

  it("is null without nights", () => {
    expect(sleepStats(daySeries(3, LAST, () => ({ sleep: null })))).toBeNull();
  });
});

describe("sleepInsights", () => {
  const ids = (days: ReturnType<typeof daySeries>) =>
    sleepInsights(days).map((i) => `${i.id}:${i.tone}`);

  it("flags a short average and frequent short nights", () => {
    const days = daySeries(20, LAST, () => ({ sleep: mkNight({ totalS: 5.6 * 3600 }) }));
    const found = ids(days);
    expect(found).toContain("sleep-average:attention");
    expect(found).toContain("short-nights:attention");
  });

  it("praises a long average", () => {
    const days = daySeries(20, LAST, () => ({ sleep: mkNight({ totalS: 8 * 3600 }) }));
    expect(ids(days)).toContain("sleep-average:positive");
  });

  it("notes an irregular bedtime and praises a regular one", () => {
    const irregular = daySeries(20, LAST, (i) => ({
      sleep: mkNight({ startLocal: at(i % 2 ? "22:00" : "01:30") }),
    }));
    expect(ids(irregular)).toContain("bedtime:info");
    const regular = daySeries(20, LAST, () => ({ sleep: mkNight({ startLocal: at("23:15") }) }));
    expect(ids(regular)).toContain("bedtime:positive");
  });

  it("notes low deep sleep", () => {
    const days = daySeries(20, LAST, () => ({
      sleep: mkNight({ totalS: 7 * 3600, deepS: 0.5 * 3600 }),
    }));
    expect(ids(days)).toContain("deep:info");
  });

  it("compares weekend and weekday sleep", () => {
    // 2026-11-05 is a Thursday; nights ending Sat/Sun are 2 h longer
    const days = daySeries(28, LAST, (i) => {
      const dow = new Date(2026, 10, 5 - (27 - i)).getDay();
      return { sleep: mkNight({ totalS: (dow === 0 || dow === 6 ? 9 : 7) * 3600 }) };
    });
    const insight = sleepInsights(days).find((i) => i.id === "weekend")!;
    expect(insight.detail).toMatch(/2 h 00 min/);
  });

  it("stays quiet with fewer than 7 nights", () => {
    expect(
      sleepInsights(daySeries(5, LAST, () => ({ sleep: mkNight({ totalS: 5 * 3600 }) }))),
    ).toEqual([]);
  });
});
