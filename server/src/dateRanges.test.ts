import { describe, expect, it } from "vitest";
import { daysInRange, splitRange } from "./dateRanges.js";

describe("splitRange", () => {
  it("splits 90 days into blocks of at most 31 days, contiguous and ordered", () => {
    const blocks = splitRange("2026-08-07", "2026-11-04", 31);
    expect(blocks).toEqual([
      { from: "2026-08-07", to: "2026-09-06" },
      { from: "2026-09-07", to: "2026-10-07" },
      { from: "2026-10-08", to: "2026-11-04" },
    ]);
  });

  it("returns one block when the range fits", () => {
    expect(splitRange("2026-11-01", "2026-11-04", 31)).toEqual([
      { from: "2026-11-01", to: "2026-11-04" },
    ]);
  });

  it("handles a single day and month/year boundaries", () => {
    expect(splitRange("2026-11-04", "2026-11-04", 31)).toEqual([
      { from: "2026-11-04", to: "2026-11-04" },
    ]);
    expect(splitRange("2025-12-20", "2026-01-25", 31)).toEqual([
      { from: "2025-12-20", to: "2026-01-19" },
      { from: "2026-01-20", to: "2026-01-25" },
    ]);
  });
});

describe("daysInRange", () => {
  it("lists every date inclusive", () => {
    expect(daysInRange("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});
