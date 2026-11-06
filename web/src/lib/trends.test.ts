import { describe, expect, it } from "vitest";
import { rollingMean, seriesSummary } from "./trends";

describe("rollingMean", () => {
  it("averages the trailing window, skipping days without data", () => {
    expect(rollingMean([10, 20, null, 30, 40], 3, 2)).toEqual([null, 15, 15, 25, 35]);
  });

  it("stays empty until the window has enough days", () => {
    expect(rollingMean([10, null, null, 20], 3, 2)).toEqual([null, null, null, null]);
  });
});

describe("seriesSummary", () => {
  it("compares the last 7 days with the whole period", () => {
    const values = [...Array(23).fill(40), ...Array(7).fill(47)];
    expect(seriesSummary(values)).toEqual({ days: 30, mean: 41.63333333333333, last7: 47 });
  });

  it("returns nulls without data", () => {
    expect(seriesSummary([null, null])).toEqual({ days: 0, mean: null, last7: null });
  });

  it("leaves last7 empty when the last week has under four days of data", () => {
    expect(seriesSummary([1, 2, 3, 4, 5, null, null, null, null, 6]).last7).toBeNull();
  });
});
