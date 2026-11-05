import type { HealthDay, SleepNight } from "../api/wellness";

export function mkNight(o: Partial<SleepNight> = {}): SleepNight {
  return {
    totalS: 7 * 3600,
    deepS: 3600,
    lightS: 4 * 3600,
    remS: 1.5 * 3600,
    awakeS: 0.5 * 3600,
    score: 80,
    scoreQualifier: "GOOD",
    startLocal: "2026-11-01T23:30",
    endLocal: "2026-11-02T06:30",
    avgHr: 48,
    avgStress: 15,
    ...o,
  };
}

/** A typical healthy day; override per field. */
export function mkDay(date: string, o: Partial<HealthDay> = {}): HealthDay {
  return {
    date,
    steps: 9000,
    stepsGoal: 9000,
    floors: 5,
    restingHr: 45,
    minHr: 40,
    maxHr: 150,
    stressAvg: 28,
    stressMax: 80,
    bodyBatteryMin: 20,
    bodyBatteryMax: 80,
    bodyBatteryCharged: 50,
    bodyBatteryDrained: 60,
    intensityModerate: 10,
    intensityVigorous: 20,
    intensityGoal: 150,
    caloriesTotal: 2600,
    caloriesActive: 400,
    respirationAvg: 14,
    sleep: mkNight(),
    hrv: { lastNightAvg: 60, weeklyAvg: 60, status: "BALANCED" },
    ...o,
  };
}

/** `n` consecutive days ending on `last`, customised per index (0 = oldest). */
export function daySeries(
  n: number,
  last: string,
  f: (i: number) => Partial<HealthDay> = () => ({}),
) {
  const [y, m, d] = last.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(y!, m! - 1, d! - (n - 1 - i));
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return mkDay(iso, f(i));
  });
}
