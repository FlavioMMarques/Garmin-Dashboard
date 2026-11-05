import { describe, expect, it } from "vitest";
import { paceDelta, percentDelta } from "./delta";

describe("percentDelta", () => {
  it("rounds and signs the change", () => {
    expect(percentDelta(120, 100)).toEqual({ text: "+20%", direction: "up", tone: "good" });
    expect(percentDelta(75, 100)).toEqual({ text: "−25%", direction: "down", tone: "bad" });
  });
  it("can treat 'up' as bad", () => {
    expect(percentDelta(120, 100, false)?.tone).toBe("bad");
  });
  it("is flat under half a percent and null without a baseline", () => {
    expect(percentDelta(100.2, 100)).toEqual({ text: "0%", direction: "flat", tone: "neutral" });
    expect(percentDelta(10, 0)).toBeNull();
  });
});

describe("paceDelta", () => {
  it("shows faster pace as negative and good", () => {
    // 5:00 /km vs 5:10 /km
    expect(paceDelta(1000 / 300, 1000 / 310)).toEqual({
      text: "−0:10 /km",
      direction: "down",
      tone: "good",
    });
  });
  it("shows slower pace as positive and bad", () => {
    expect(paceDelta(1000 / 375, 1000 / 300)).toMatchObject({ text: "+1:15 /km", tone: "bad" });
  });
  it("is null without both paces", () => {
    expect(paceDelta(null, 3)).toBeNull();
  });
});
