const pad2 = (n: number) => n.toString().padStart(2, "0");

/** The local calendar day as YYYY-MM-DD (Garmin's calendarDate is local, not UTC). */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** YYYY-MM-DD plus/minus whole days; done in UTC so DST never skips or repeats a day. */
export function shiftDate(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

const STRESS_LABELS: Record<string, string> = {
  CALM: "Calmo",
  BALANCED: "Equilibrado",
  STRESSFUL: "Estressante",
  VERY_STRESSFUL: "Muito estressante",
};

export function stressLabel(qualifier: string | null | undefined): string | null {
  return (qualifier && STRESS_LABELS[qualifier.toUpperCase()]) || null;
}

/** Garmin's intensity minutes: each vigorous minute counts as two. */
export function intensityMinutes(
  moderate: number | null | undefined,
  vigorous: number | null | undefined,
): number | null {
  if (moderate == null && vigorous == null) return null;
  return (moderate ?? 0) + 2 * (vigorous ?? 0);
}
