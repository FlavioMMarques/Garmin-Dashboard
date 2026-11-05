/** Inclusive date ranges as local "YYYY-MM-DD" strings (UTC arithmetic: no DST surprises). */

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
};

/** Every date from `from` to `to`, inclusive. */
export function daysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Split [from, to] into contiguous blocks of at most `maxDays` days (Garmin's per-call limits). */
export function splitRange(
  from: string,
  to: string,
  maxDays: number,
): { from: string; to: string }[] {
  const blocks: { from: string; to: string }[] = [];
  for (let start = from; start <= to; start = addDays(start, maxDays)) {
    const end = addDays(start, maxDays - 1);
    blocks.push({ from: start, to: end < to ? end : to });
  }
  return blocks;
}

export function spanDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000) + 1;
}
