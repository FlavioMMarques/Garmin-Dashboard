import { describe, expect, it } from "vitest";
import type { KmSplit } from "../api/runs";
import {
  cadenceFadeInsight,
  cardiacDriftInsight,
  fastestSlowestInsight,
  generateSplitInsights,
  halvesInsight,
  steadyPaceInsight,
} from "./splitInsights";

function km(n: number, paceSecPerKm: number, over: Partial<KmSplit> = {}): KmSplit {
  return {
    km: n,
    distanceM: 1000,
    durationS: paceSecPerKm,
    paceSecPerKm,
    avgHr: 150,
    cadenceSpm: 170,
    elevationGainM: 1,
    partial: false,
    ...over,
  };
}

const run = (paces: number[], over: (i: number) => Partial<KmSplit> = () => ({})) =>
  paces.map((p, i) => km(i + 1, p, over(i)));

describe("halvesInsight", () => {
  it("praises a negative split", () => {
    const i = halvesInsight(run([340, 338, 330, 322]));
    expect(i?.tone).toBe("positive");
    expect(i?.title).toContain("Negative split");
  });

  it("notes a pace that faded in the second half", () => {
    expect(halvesInsight(run([320, 322, 335, 345]))?.tone).toBe("info");
  });

  it("stays quiet on even halves, and needs three full kilometres", () => {
    expect(halvesInsight(run([330, 331, 330, 331]))).toBeNull();
    expect(halvesInsight(run([340, 320]))).toBeNull();
  });

  it("ignores a final partial kilometre", () => {
    const splits = [...run([330, 330, 330, 330]), km(5, 280, { partial: true, distanceM: 300 })];
    expect(halvesInsight(splits)).toBeNull();
  });
});

describe("cardiacDriftInsight", () => {
  it("measures HR rising at the same pace", () => {
    const i = cardiacDriftInsight(run([330, 330, 330, 330], (k) => ({ avgHr: k < 2 ? 150 : 162 })));
    expect(i?.tone).toBe("info");
    expect(i?.title).toContain("8%");
  });

  it("praises a steady heart rate", () => {
    expect(cardiacDriftInsight(run([330, 330, 330, 330]))?.tone).toBe("positive");
  });

  it("accounts for speeding up: a faster second half explains a higher HR", () => {
    const i = cardiacDriftInsight(run([340, 340, 315, 315], (k) => ({ avgHr: k < 2 ? 150 : 162 })));
    expect(i?.tone).toBe("positive");
  });

  it("leaves out the first kilometre, while heart rate is still rising", () => {
    // Warm-up km at 130 bpm, then a steady 160 bpm at the same pace.
    const i = cardiacDriftInsight(
      run([330, 330, 330, 330, 330], (k) => ({ avgHr: k === 0 ? 130 : 160 })),
    );
    expect(i?.tone).toBe("positive");
  });

  it("needs heart rate on every kilometre", () => {
    expect(
      cardiacDriftInsight(run([330, 330, 330, 330], (k) => ({ avgHr: k === 1 ? null : 150 }))),
    ).toBeNull();
  });
});

describe("steadyPaceInsight", () => {
  it("praises very even kilometres", () => {
    expect(steadyPaceInsight(run([330, 333, 328, 331, 332]))?.tone).toBe("positive");
  });

  it("stays quiet on uneven kilometres", () => {
    expect(steadyPaceInsight(run([300, 360, 310, 350]))).toBeNull();
  });
});

describe("cadenceFadeInsight", () => {
  it("notes cadence dropping at the end", () => {
    const i = cadenceFadeInsight(
      run([330, 330, 330, 330], (k) => ({ cadenceSpm: k === 3 ? 164 : 170 })),
    );
    expect(i?.tone).toBe("info");
    expect(i?.detail).toContain("170");
  });

  it("stays quiet on a steady cadence", () => {
    expect(cadenceFadeInsight(run([330, 330, 330, 330]))).toBeNull();
  });
});

describe("fastestSlowestInsight", () => {
  it("names the fastest and slowest kilometres", () => {
    const i = fastestSlowestInsight(run([345, 350, 328, 323, 327, 352]));
    expect(i?.title).toContain("km 4");
    expect(i?.detail).toContain("km 6");
    expect(i?.detail).toContain("5:23");
  });
});

describe("generateSplitInsights", () => {
  it("returns nothing for a run under three full kilometres", () => {
    expect(generateSplitInsights(run([330, 330]))).toEqual([]);
  });
});
