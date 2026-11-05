import { toIsoDate } from "./runStats";

/** The fields volume math needs; RunSummary satisfies it. */
interface Run {
  startLocal: string;
  distanceM: number | null;
}

/** "YYYY-MM-DD" → local midnight Date (no timezone shift). */
function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const km = (r: Run) => (r.distanceM ?? 0) / 1000;

/** Day the week starts on: 0 = Sunday … 6 = Saturday (Date#getDay numbering). */
export type WeekStartDay = number;

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_NAMES_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Garmin's firstDayOfWeek name → WeekStartDay; Monday (ISO) when unknown. */
export function weekStartsOnFrom(dayName: string | null | undefined): WeekStartDay {
  const i = DAY_NAMES.indexOf(dayName?.toLowerCase() ?? "");
  return i >= 0 ? i : 1;
}

/** e.g. "domingo a sábado". */
export function weekRangeLabel(startsOn: WeekStartDay): string {
  return `${DAY_NAMES_PT[startsOn]} a ${DAY_NAMES_PT[(startsOn + 6) % 7]}`;
}

/** First day of the week containing `day` (YYYY-MM-DD); Monday (ISO week) by default. */
export function weekStart(day: string, startsOn: WeekStartDay = 1): string {
  const d = parseDay(day);
  const back = (d.getDay() - startsOn + 7) % 7;
  return toIsoDate(addDays(d, -back));
}

export interface WeekVolume {
  weekStart: string;
  km: number;
  runs: number;
  longestKm: number;
}

/** One entry per week from `from` (or the first run) to `to`; weeks without runs are zero. */
export function weeklyVolume(
  runs: Run[],
  from: string | undefined,
  to: string,
  startsOn: WeekStartDay = 1,
): WeekVolume[] {
  const first = from ?? runs[0]?.startLocal;
  if (!first) return [];
  const byWeek = new Map<string, WeekVolume>();
  for (let d = parseDay(weekStart(first, startsOn)); toIsoDate(d) <= to; d = addDays(d, 7)) {
    const key = toIsoDate(d);
    byWeek.set(key, { weekStart: key, km: 0, runs: 0, longestKm: 0 });
  }
  for (const r of runs) {
    const week = byWeek.get(weekStart(r.startLocal, startsOn));
    if (!week) continue;
    week.km += km(r);
    week.runs += 1;
    week.longestKm = Math.max(week.longestKm, km(r));
  }
  return [...byWeek.values()];
}

export interface MonthVolume {
  /** "YYYY-MM" */
  month: string;
  km: number;
  runs: number;
}

export function monthlyVolume(runs: Run[], from: string | undefined, to: string): MonthVolume[] {
  const first = from ?? runs[0]?.startLocal;
  if (!first) return [];
  const byMonth = new Map<string, MonthVolume>();
  const start = parseDay(first);
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); toIsoDate(d) <= to;) {
    const key = toIsoDate(d).slice(0, 7);
    byMonth.set(key, { month: key, km: 0, runs: 0 });
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  for (const r of runs) {
    const month = byMonth.get(r.startLocal.slice(0, 7));
    if (!month) continue;
    month.km += km(r);
    month.runs += 1;
  }
  return [...byMonth.values()];
}

export interface YtdRow {
  /** Day of year, 1-based. */
  day: number;
  /** Cumulative km this year; null after today. */
  current: number | null;
  /** Cumulative km last year; null when last year has no runs. */
  previous: number | null;
}

export interface YearToDate {
  year: number;
  rows: YtdRow[];
  currentKm: number;
  previousSameDateKm: number;
  hasPrevious: boolean;
}

function dayOfYear(day: string): number {
  const d = parseDay(day);
  return Math.round((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86_400_000) + 1;
}

/** Cumulative distance per day of year: this year up to `today` vs the whole of last year. */
export function yearToDate(runs: Run[], today: string): YearToDate {
  const year = Number(today.slice(0, 4));
  const daysInYear = dayOfYear(`${year}-12-31`);
  const todayDoy = dayOfYear(today);
  const perDay = {
    current: new Array<number>(367).fill(0),
    previous: new Array<number>(367).fill(0),
  };
  let hasPrevious = false;

  for (const r of runs) {
    const y = Number(r.startLocal.slice(0, 4));
    const doy = dayOfYear(r.startLocal);
    if (y === year && doy <= todayDoy) perDay.current[doy]! += km(r);
    else if (y === year - 1) {
      perDay.previous[doy]! += km(r);
      hasPrevious = true;
    }
  }

  const rows: YtdRow[] = [];
  let current = 0;
  let previous = 0;
  for (let day = 1; day <= daysInYear; day++) {
    current += perDay.current[day]!;
    previous += perDay.previous[day]!;
    rows.push({
      day,
      current: day <= todayDoy ? current : null,
      previous: hasPrevious ? previous : null,
    });
  }
  const sameDate = rows[todayDoy - 1];
  return {
    year,
    rows,
    currentKm: sameDate?.current ?? 0,
    previousSameDateKm: sameDate?.previous ?? 0,
    hasPrevious,
  };
}
