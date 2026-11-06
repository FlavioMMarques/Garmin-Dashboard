/** Calendar-date (YYYY-MM-DD) helpers, computed in UTC so DST never skips or repeats a day. */

const DAY_MS = 86_400_000;

function toMs(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Number of calendar days from `from` to `to`, both included. */
export function daysInRange(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS) + 1;
}

/** Every day from `from` to `to`, both included; empty when reversed. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = toMs(from); t <= toMs(to); t += DAY_MS) days.push(toDate(t));
  return days;
}

/** Contiguous blocks of at most `maxDays` days covering the range. */
export function splitRange(
  from: string,
  to: string,
  maxDays: number,
): { start: string; end: string }[] {
  const blocks: { start: string; end: string }[] = [];
  const last = toMs(to);
  for (let t = toMs(from); t <= last; t += maxDays * DAY_MS) {
    blocks.push({ start: toDate(t), end: toDate(Math.min(t + (maxDays - 1) * DAY_MS, last)) });
  }
  return blocks;
}
