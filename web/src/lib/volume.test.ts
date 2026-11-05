import { describe, expect, it } from "vitest";
import {
  monthlyVolume,
  weekRangeLabel,
  weekStart,
  weekStartsOnFrom,
  weeklyVolume,
  yearToDate,
} from "./volume";

type R = { startLocal: string; distanceM: number | null };
const r = (startLocal: string, km: number): R => ({ startLocal, distanceM: km * 1000 });

describe("weekStart", () => {
  it("returns the Monday of the ISO week", () => {
    expect(weekStart("2026-11-05")).toBe("2026-11-02"); // Thursday → Monday
    expect(weekStart("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday belongs to the week before
  });
  it("crosses month and year boundaries", () => {
    expect(weekStart("2026-01-01")).toBe("2025-12-29");
  });
});

describe("weeklyVolume", () => {
  it("sums km per week and fills weeks without runs with zero", () => {
    const runs = [
      r("2026-10-06 07:00:00", 10),
      r("2026-10-08 07:00:00", 5),
      r("2026-10-22 07:00:00", 8),
    ];
    expect(weeklyVolume(runs, "2026-10-05", "2026-10-25")).toEqual([
      { weekStart: "2026-10-05", km: 15, runs: 2, longestKm: 10 },
      { weekStart: "2026-10-12", km: 0, runs: 0, longestKm: 0 },
      { weekStart: "2026-10-19", km: 8, runs: 1, longestKm: 8 },
    ]);
  });

  it("starts at the first run when there is no lower bound", () => {
    const weeks = weeklyVolume([r("2026-10-20 07:00:00", 5)], undefined, "2026-10-28");
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-10-19", "2026-10-26"]);
  });

  it("returns nothing without runs and without a lower bound", () => {
    expect(weeklyVolume([], undefined, "2026-10-28")).toEqual([]);
  });
});

describe("monthlyVolume", () => {
  it("sums km per calendar month, including empty months", () => {
    const runs = [r("2026-08-30 07:00:00", 10), r("2026-10-01 07:00:00", 6)];
    expect(monthlyVolume(runs, "2026-08-15", "2026-10-20")).toEqual([
      { month: "2026-08", km: 10, runs: 1 },
      { month: "2026-09", km: 0, runs: 0 },
      { month: "2026-10", km: 6, runs: 1 },
    ]);
  });
});

describe("yearToDate", () => {
  const today = "2026-03-02";
  const runs = [
    r("2025-01-10 07:00:00", 10),
    r("2025-03-01 07:00:00", 5),
    r("2025-03-05 07:00:00", 7), // after the same point last year
    r("2026-01-05 07:00:00", 12),
    r("2026-03-02 07:00:00", 4),
  ];

  it("builds cumulative km per day of year for this year (to today) and last year (full)", () => {
    const ytd = yearToDate(runs, today);
    expect(ytd.year).toBe(2026);
    const day = (d: number) => ytd.rows[d - 1]!;
    expect(day(1)).toEqual({ day: 1, current: 0, previous: 0 });
    expect(day(10)).toMatchObject({ current: 12, previous: 10 });
    expect(day(61)).toEqual({ day: 61, current: 16, previous: 15 }); // 2 Mar / 2 Mar
    expect(day(62)).toMatchObject({ current: null }); // future
    expect(ytd.rows).toHaveLength(365);
    expect(ytd.rows.at(-1)).toMatchObject({ previous: 22 });
  });

  it("compares with last year at the same date", () => {
    expect(yearToDate(runs, today)).toMatchObject({ currentKm: 16, previousSameDateKm: 15 });
  });

  it("marks last year as missing when there are no runs in it", () => {
    const ytd = yearToDate([r("2026-01-05 07:00:00", 12)], today);
    expect(ytd.hasPrevious).toBe(false);
    expect(ytd.rows[0]!.previous).toBeNull();
  });
});

describe("week start preference", () => {
  it("supports weeks starting on Sunday", () => {
    expect(weekStart("2026-11-05", 0)).toBe("2026-11-01"); // Thursday → Sunday
    expect(weekStart("2026-11-01", 0)).toBe("2026-11-01"); // Sunday
    expect(weekStart("2026-11-07", 0)).toBe("2026-11-01"); // Saturday
  });

  it("maps Garmin day names, defaulting to Monday", () => {
    expect(weekStartsOnFrom("sunday")).toBe(0);
    expect(weekStartsOnFrom("monday")).toBe(1);
    expect(weekStartsOnFrom("saturday")).toBe(6);
    expect(weekStartsOnFrom(null)).toBe(1);
    expect(weekStartsOnFrom("whatever")).toBe(1);
  });

  it("labels the week range in Portuguese", () => {
    expect(weekRangeLabel(0)).toBe("domingo a sábado");
    expect(weekRangeLabel(1)).toBe("segunda a domingo");
  });

  it("groups weekly volume by the chosen start day", () => {
    const weeks = weeklyVolume(
      [r("2026-11-01 07:00:00", 5), r("2026-11-02 07:00:00", 5)], // Sun + Mon
      "2026-11-01",
      "2026-11-07",
      0,
    );
    expect(weeks).toEqual([{ weekStart: "2026-11-01", km: 10, runs: 2, longestKm: 5 }]);
  });
});
