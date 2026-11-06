import { describe, expect, it } from "vitest";
import { daysInRange, eachDay, splitRange } from "./dateRanges.js";

describe("eachDay", () => {
  it("lists every calendar day, both ends included", () => {
    expect(eachDay("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("is empty when the range is reversed", () => {
    expect(eachDay("2026-03-02", "2026-03-01")).toEqual([]);
  });
});

describe("daysInRange", () => {
  it("counts both ends", () => {
    expect(daysInRange("2025-11-04", "2026-11-04")).toBe(366);
    expect(daysInRange("2026-11-04", "2026-11-04")).toBe(1);
  });
});

describe("splitRange", () => {
  it("keeps a range that fits in one block", () => {
    expect(splitRange("2025-11-04", "2026-11-04", 366)).toEqual([
      { start: "2025-11-04", end: "2026-11-04" },
    ]);
  });

  it("splits into contiguous blocks with no gap or overlap", () => {
    expect(splitRange("2026-01-01", "2026-01-10", 4)).toEqual([
      { start: "2026-01-01", end: "2026-01-04" },
      { start: "2026-01-05", end: "2026-01-08" },
      { start: "2026-01-09", end: "2026-01-10" },
    ]);
  });

  it("needs two blocks for 400 days at 366 per block", () => {
    expect(splitRange("2025-10-01", "2026-11-04", 366)).toHaveLength(2);
  });
});
