import { describe, expect, it } from "vitest";
import { intensityMinutes, localDateKey, shiftDate, stressLabel } from "./health";

describe("localDateKey", () => {
  it("uses the local calendar day, not UTC", () => {
    // 23:30 local on Nov 4 is already Nov 5 in UTC for negative offsets.
    expect(localDateKey(new Date(2026, 10, 4, 23, 30))).toBe("2026-11-04");
  });

  it("pads month and day", () => {
    expect(localDateKey(new Date(2026, 0, 7))).toBe("2026-01-07");
  });
});

describe("shiftDate", () => {
  it("moves across month and year boundaries", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is not thrown off by daylight-saving changes", () => {
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("stressLabel", () => {
  it("translates Garmin's qualifiers", () => {
    expect(stressLabel("BALANCED")).toBe("Equilibrado");
    expect(stressLabel("calm")).toBe("Calmo");
    expect(stressLabel("VERY_STRESSFUL")).toBe("Muito estressante");
  });

  it("returns null for unknown or missing qualifiers", () => {
    expect(stressLabel("UNKNOWN")).toBeNull();
    expect(stressLabel(null)).toBeNull();
  });
});

describe("intensityMinutes", () => {
  it("counts vigorous minutes double, like Garmin", () => {
    expect(intensityMinutes(20, 15)).toBe(50);
  });

  it("is null only when both parts are missing", () => {
    expect(intensityMinutes(null, null)).toBeNull();
    expect(intensityMinutes(10, null)).toBe(10);
  });
});
