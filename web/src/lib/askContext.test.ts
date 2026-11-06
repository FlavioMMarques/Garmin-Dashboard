import { describe, expect, it } from "vitest";
import type { RunSummary } from "../api/runs";
import type { DayPoint } from "../api/daily";
import type { Night } from "../api/sleep";
import { buildAskContext } from "./askContext";

function run(over: Partial<RunSummary>): RunSummary {
  return {
    id: 1,
    startLocal: "2026-11-05 19:10:00",
    type: "running",
    distanceM: 6010,
    durationS: 2027,
    movingS: 2020,
    avgSpeedMps: 1000 / 337,
    avgHr: 159,
    maxHr: 176,
    cadenceSpm: 168.4,
    strideCm: null,
    verticalOscCm: null,
    groundContactMs: null,
    verticalRatio: null,
    powerW: null,
    elevationGainM: 12,
    tempC: 28,
    aerobicTe: 3.4,
    anaerobicTe: 1.2,
    trainingLabel: "TEMPO",
    bestS: { "1000": null, "1609": null, "5000": null, "10000": null, "21098": null },
    hrZonesS: null,
    ...over,
  };
}

function day(over: Partial<DayPoint>): DayPoint {
  return {
    date: "2026-11-05",
    hasData: true,
    steps: 11100,
    stepGoal: 9050,
    restingHr: 44,
    stressAvg: 27,
    stressHighShare: 0.05,
    bodyBatteryMin: 12,
    bodyBatteryMax: 88,
    bodyBatteryCharged: 70,
    bodyBatteryDrained: 75,
    intensityModerate: 10,
    intensityVigorous: 34,
    intensityGoal: 150,
    caloriesActive: 600,
    ...over,
  };
}

function night(over: Partial<Night>): Night {
  return {
    date: "2026-11-06",
    hasData: true,
    sleepSeconds: 4 * 3600 + 9 * 60,
    deepSeconds: 46 * 60,
    lightSeconds: 184 * 60,
    remSeconds: 19 * 60,
    awakeSeconds: 18 * 60,
    napSeconds: null,
    startLocal: "2026-11-06T02:23",
    endLocal: "2026-11-06T06:50",
    score: 51,
    scoreQualifier: "POOR",
    awakeCount: 2,
    avgSleepStress: 20,
    avgHr: 50,
    avgRespiration: 14,
    avgSpO2: 95,
    sleepNeedMinutes: 507,
    hrvLastNight: 103,
    hrvWeeklyAvg: 102,
    hrvStatus: "BALANCED",
    hrvBalancedLow: 97,
    hrvBalancedUpper: 121,
    ...over,
  };
}

const base = { today: "2026-11-06", runs: [], days: [], nights: [], weekStartsOn: 0 };

describe("buildAskContext", () => {
  it("dates the summary so the model knows what 'this week' means", () => {
    expect(buildAskContext(base)).toContain("Hoje: 2026-11-06 (sexta-feira)");
  });

  it("lists each run with the numbers already formatted", () => {
    const text = buildAskContext({ ...base, runs: [run({})] });
    expect(text).toContain(
      "2026-11-05 19:10 | corrida | 6.01 | 33:47 | 5:37 | 159 | 176 | 168 | 3.4 | TEMPO | 28 | 12",
    );
  });

  it("shows missing values as a dash instead of 0 or null", () => {
    const text = buildAskContext({
      ...base,
      runs: [run({ avgHr: null, tempC: null, trainingLabel: null, avgSpeedMps: null })],
    });
    const line = text.split("\n").find((l) => l.startsWith("2026-11-05 19:10"))!;
    expect(line).not.toMatch(/null|undefined|NaN/);
    expect(line).toContain("| — |");
  });

  it("totals runs per week, starting on the user's first day of the week", () => {
    const runs = [
      run({ startLocal: "2026-11-01 07:00:00", distanceM: 10000 }), // Sunday
      run({ startLocal: "2026-11-05 19:00:00", distanceM: 6000 }),
    ];
    const text = buildAskContext({ ...base, runs, weekStartsOn: 0 });
    expect(text).toContain("Volume semanal (semanas de domingo a sábado)");
    expect(text).toContain("2026-11-01 | 16.0 | 2 | 10.0");
  });

  it("totals runs per month", () => {
    const runs = [
      run({ startLocal: "2026-10-31 06:30:00", distanceM: 10010 }),
      run({ startLocal: "2026-11-05 19:00:00", distanceM: 6010 }),
    ];
    const text = buildAskContext({ ...base, runs });
    expect(text).toContain("2026-10 | 10.0 | 1");
    expect(text).toContain("2026-11 | 6.0 | 1");
  });

  it("includes daily health, skipping days without data", () => {
    const days = [day({}), day({ date: "2026-11-04", hasData: false })];
    const text = buildAskContext({ ...base, days });
    expect(text).toContain("2026-11-05 | 11100 | 9050 | 44 | 27 | 12–88 | 10/34");
    expect(text).not.toContain("2026-11-04 |");
  });

  it("includes each night with phases, score and HRV", () => {
    const text = buildAskContext({ ...base, nights: [night({})] });
    expect(text).toContain(
      "2026-11-06 | 02:23 | 06:50 | 4:09 | 0:46 | 3:04 | 0:19 | 0:18 | 51 | 103 | 8:27",
    );
  });

  it("says when a section has no data, so the model doesn't guess", () => {
    const text = buildAskContext(base);
    expect(text).toMatch(/## Corridas[^\n]*\n\(sem dados\)/);
    expect(text).toMatch(/## Sono[^\n]*\n\(sem dados\)/);
  });
});
