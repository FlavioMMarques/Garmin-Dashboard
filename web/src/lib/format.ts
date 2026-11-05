const DASH = "—";

const decimal = (digits: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const km2 = decimal(2);
const kmh1 = decimal(1);

const pad2 = (n: number) => n.toString().padStart(2, "0");

function isPositive(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** 2081 → "34:41"; 6670 → "1:51:10". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

export function formatDistance(meters: number | null | undefined): string {
  return isPositive(meters) ? `${km2.format(meters / 1000)} km` : DASH;
}

/** Speed in m/s → "5:46 /km". */
export function formatPace(mps: number | null | undefined): string {
  if (!isPositive(mps)) return DASH;
  const secPerKm = Math.round(1000 / mps);
  return `${Math.floor(secPerKm / 60)}:${pad2(secPerKm % 60)} /km`;
}

/** Speed in m/s → "30,0 km/h". */
export function formatSpeed(mps: number | null | undefined): string {
  return isPositive(mps) ? `${kmh1.format(mps * 3.6)} km/h` : DASH;
}

const PACE_TYPES = /running|walking|hiking/;

/** Foot sports are read as pace; everything else as speed. */
export function usesPace(typeKey: string): boolean {
  return PACE_TYPES.test(typeKey);
}

export function formatSpeedFor(typeKey: string, mps: number | null | undefined): string {
  return usesPace(typeKey) ? formatPace(mps) : formatSpeed(mps);
}

/** "2026-11-03 19:01:46" → "03/11/2026 19:01" (string-based: no timezone conversion). */
export function formatLocalDateTime(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(local);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : local;
}

const TYPE_LABELS: Record<string, string> = {
  running: "Corrida",
  treadmill_running: "Esteira",
  trail_running: "Trail",
  track_running: "Pista",
  indoor_running: "Corrida indoor",
  walking: "Caminhada",
  hiking: "Trilha",
  cycling: "Ciclismo",
  road_biking: "Ciclismo (estrada)",
  mountain_biking: "Mountain bike",
  indoor_cycling: "Bike indoor",
  lap_swimming: "Natação (piscina)",
  open_water_swimming: "Natação (águas abertas)",
  strength_training: "Musculação",
  yoga: "Yoga",
  other: "Outro",
};

export function activityTypeLabel(typeKey: string): string {
  return TYPE_LABELS[typeKey] ?? typeKey.replaceAll("_", " ");
}

/** Totals for tiles: "412 km" from 100 km up, "68,4 km" below. */
export function formatKmTotal(meters: number): string {
  const km = meters / 1000;
  return `${(km >= 100 ? decimal(0) : kmh1).format(km)} km`;
}

/** 137520 → "38 h 12 min"; 2700 → "45 min". */
export function formatTotalTime(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${pad2(m)} min` : `${m} min`;
}

/** "2026-10-05" → "05/10". */
export function formatDayMonth(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-10" → "out/26". */
export function formatMonthShort(month: string): string {
  return `${MONTHS_SHORT[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`;
}

/** Day-of-year (1-based) → "dd/mm" for that year. */
export function dayOfYearLabel(year: number, day: number): string {
  const d = new Date(year, 0, day);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

export function formatKm1(km: number): string {
  return `${kmh1.format(km)} km`;
}

/** pt-BR number with fixed decimals: 1.0834 → "1,08". */
export function formatDecimal(n: number, digits = 2): string {
  return decimal(digits).format(n);
}
