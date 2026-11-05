import { describe, expect, it } from "vitest";
import {
  activityTypeLabel,
  formatDistance,
  formatDuration,
  dayOfYearLabel,
  formatDayMonth,
  formatDecimal,
  formatKm1,
  formatKmTotal,
  formatMonthShort,
  formatTotalTime,
  formatLocalDateTime,
  formatPace,
  formatSpeed,
  formatSpeedFor,
  usesPace,
} from "./format";

describe("formatDuration", () => {
  it("uses m:ss under one hour and h:mm:ss above", () => {
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(2081.125)).toBe("34:41");
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(6670.6)).toBe("1:51:11");
  });
  it("returns a dash when missing", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("formatDistance", () => {
  it("shows km with two decimals and a comma", () => {
    expect(formatDistance(6014.28)).toBe("6,01 km");
    expect(formatDistance(10010.94)).toBe("10,01 km");
  });
  it("returns a dash for missing or zero distance", () => {
    expect(formatDistance(null)).toBe("—");
    expect(formatDistance(0)).toBe("—");
  });
});

describe("formatPace", () => {
  it("converts m/s to min/km", () => {
    expect(formatPace(2.89)).toBe("5:46 /km");
    expect(formatPace(1000 / 300)).toBe("5:00 /km");
  });
  it("never shows 60 seconds", () => {
    // 359.8 s/km must round to 6:00, not 5:60
    expect(formatPace(1000 / 359.8)).toBe("6:00 /km");
  });
  it("returns a dash for missing or zero speed", () => {
    expect(formatPace(null)).toBe("—");
    expect(formatPace(0)).toBe("—");
  });
});

describe("formatSpeed", () => {
  it("converts m/s to km/h", () => {
    expect(formatSpeed(8.3333)).toBe("30,0 km/h");
  });
});

describe("usesPace / formatSpeedFor", () => {
  it("uses pace for running, walking and hiking", () => {
    for (const t of ["running", "treadmill_running", "trail_running", "walking", "hiking"]) {
      expect(usesPace(t), t).toBe(true);
    }
    expect(usesPace("cycling")).toBe(false);
  });
  it("formats by activity type", () => {
    expect(formatSpeedFor("running", 2.89)).toBe("5:46 /km");
    expect(formatSpeedFor("cycling", 8.3333)).toBe("30,0 km/h");
  });
});

describe("formatLocalDateTime", () => {
  it("formats Garmin local timestamps without timezone shifts", () => {
    expect(formatLocalDateTime("2026-11-03 19:01:46")).toBe("03/11/2026 19:01");
  });
});

describe("activityTypeLabel", () => {
  it("translates known types and humanizes unknown ones", () => {
    expect(activityTypeLabel("running")).toBe("Corrida");
    expect(activityTypeLabel("treadmill_running")).toBe("Esteira");
    expect(activityTypeLabel("some_new_sport")).toBe("some new sport");
  });
});

describe("tile totals", () => {
  it("formats km totals with precision that fits the size", () => {
    expect(formatKmTotal(412_345)).toBe("412 km");
    expect(formatKmTotal(68_420)).toBe("68,4 km");
  });
  it("formats total time in hours and minutes", () => {
    expect(formatTotalTime(137_520)).toBe("38 h 12 min");
    expect(formatTotalTime(2700)).toBe("45 min");
  });
});

describe("axis labels", () => {
  it("formats days and months in pt-BR", () => {
    expect(formatDayMonth("2026-10-05")).toBe("05/10");
    expect(formatMonthShort("2026-10")).toBe("out/26");
    expect(formatMonthShort("2026-01")).toBe("jan/26");
  });
  it("converts a day of year back to a date label", () => {
    expect(dayOfYearLabel(2026, 1)).toBe("01/01");
    expect(dayOfYearLabel(2026, 61)).toBe("02/03");
  });
  it("formats km with one decimal", () => {
    expect(formatKm1(12.345)).toBe("12,3 km");
  });
});

describe("formatDecimal", () => {
  it("uses a comma and fixed decimals", () => {
    expect(formatDecimal(1.0834)).toBe("1,08");
    expect(formatDecimal(36.54, 1)).toBe("36,5");
  });
});
