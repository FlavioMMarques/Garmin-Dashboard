import { describe, expect, it } from "vitest";
import { durationDelta, paceDelta, percentDelta } from "./delta";

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

describe("durationDelta", () => {
  it("shows a faster time as negative and good", () => {
    expect(durationDelta(1563, 1605)).toEqual({ text: "−0:42", direction: "down", tone: "good" });
  });
  it("uses h:mm:ss above an hour and flags slower as bad", () => {
    expect(durationDelta(8000, 4000)).toMatchObject({ text: "+1:06:40", tone: "bad" });
  });
  it("is null without both times and flat when equal", () => {
    expect(durationDelta(null, 100)).toBeNull();
    expect(durationDelta(100, 100.2)).toMatchObject({ direction: "flat", text: "0:00" });
  });
});
