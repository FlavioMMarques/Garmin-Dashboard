import { describe, expect, it } from "vitest";
import { predictRaceTime, trainingPaces } from "./daniels";

const within1pct = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThan(0.01);

describe("predictRaceTime", () => {
  it("matches Daniels' VDOT 50 equivalents", () => {
    within1pct(predictRaceTime(50, 5000), 19 * 60 + 57);
    within1pct(predictRaceTime(50, 10000), 41 * 60 + 21);
    within1pct(predictRaceTime(50, 21097.5), 1 * 3600 + 31 * 60 + 35);
    within1pct(predictRaceTime(50, 42195), 3 * 3600 + 10 * 60 + 49);
  });

  it("is slower for a lower VDOT", () => {
    expect(predictRaceTime(37, 5000)).toBeGreaterThan(predictRaceTime(50, 5000));
  });
});

describe("trainingPaces", () => {
  it("gives threshold and interval paces from Daniels' tables (s/km)", () => {
    const paces = trainingPaces(50);
    within1pct(paces.threshold, 4 * 60 + 15);
    within1pct(paces.interval, 3 * 60 + 55);
  });

  it("uses marathon race pace for M and an easy range slower than M", () => {
    const paces = trainingPaces(50);
    within1pct(paces.marathon, (3 * 3600 + 10 * 60 + 49) / 42.195);
    expect(paces.easy.fast).toBeGreaterThan(paces.marathon);
    expect(paces.easy.slow).toBeGreaterThan(paces.easy.fast);
  });
});
