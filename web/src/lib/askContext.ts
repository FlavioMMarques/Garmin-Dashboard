import type { RunSummary } from "../api/runs";
import type { DayPoint } from "../api/daily";
import type { Night } from "../api/sleep";
import { activityTypeLabel } from "./format";
import { monthlyVolume, weekRangeLabel, weeklyVolume, type WeekStartDay } from "./volume";

/**
 * The dashboard data as compact text tables for "Pergunte". Numbers arrive already computed
 * and formatted, so the model reads them instead of doing arithmetic (where it errs most).
 * Decimals use a dot so they never clash with the table's separators.
 */
export interface AskContextInput {
  /** YYYY-MM-DD, local. */
  today: string;
  runs: RunSummary[];
  days: DayPoint[];
  nights: Night[];
  weekStartsOn: WeekStartDay;
}

const DASH = "—";
const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const num = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v) ? DASH : v.toFixed(digits);

/** Seconds → "h:mm" (sleep) or "m:ss"/"h:mm:ss" (runs). */
function clock(seconds: number | null | undefined, style: "hm" | "ms"): string {
  if (seconds == null || !Number.isFinite(seconds)) return DASH;
  const p = (n: number) => n.toString().padStart(2, "0");
  if (style === "hm") {
    const minutes = Math.round(seconds / 60);
    return `${Math.floor(minutes / 60)}:${p(minutes % 60)}`;
  }
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`;
}

const pace = (mps: number | null) => (mps && mps > 0 ? clock(1000 / mps, "ms") : DASH);
const time = (local: string | null) => (local ? local.slice(11, 16) : DASH);
const row = (cells: string[]) => cells.join(" | ");

function section(title: string, header: string, rows: string[]): string {
  return [`## ${title}`, ...(rows.length ? [header, ...rows] : ["(sem dados)"])].join("\n");
}

function runsSection(runs: RunSummary[]): string {
  const title = runs.length
    ? `Corridas (${runs.length}, de ${runs[0]!.startLocal.slice(0, 10)} a ${runs.at(-1)!.startLocal.slice(0, 10)})`
    : "Corridas";
  return section(
    title,
    "data | tipo | km | tempo | ritmo min/km | FC média | FC máx | cadência ppm | efeito aeróbico | tipo de treino (Garmin) | temp °C | subida m",
    runs.map((r) =>
      row([
        r.startLocal.slice(0, 16),
        activityTypeLabel(r.type).toLowerCase(),
        num(r.distanceM == null ? null : r.distanceM / 1000, 2),
        clock(r.durationS, "ms"),
        pace(r.avgSpeedMps),
        num(r.avgHr),
        num(r.maxHr),
        num(r.cadenceSpm),
        num(r.aerobicTe, 1),
        r.trainingLabel ?? DASH,
        num(r.tempC),
        num(r.elevationGainM),
      ]),
    ),
  );
}

export function buildAskContext({
  today,
  runs,
  days,
  nights,
  weekStartsOn,
}: AskContextInput): string {
  const [y, m, d] = today.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y!, m! - 1, d!).getDay()];
  const from = runs[0]?.startLocal.slice(0, 10);

  const weeks = from ? weeklyVolume(runs, from, today, weekStartsOn) : [];
  const months = from ? monthlyVolume(runs, from, today) : [];

  return [
    `Hoje: ${today} (${weekday}).`,
    runsSection(runs),
    section(
      `Volume semanal (semanas de ${weekRangeLabel(weekStartsOn)})`,
      "início da semana | km | corridas | maior corrida km",
      weeks.map((w) => row([w.weekStart, num(w.km, 1), String(w.runs), num(w.longestKm, 1)])),
    ),
    section(
      "Volume mensal",
      "mês | km | corridas",
      months.map((mo) => row([mo.month, num(mo.km, 1), String(mo.runs)])),
    ),
    section(
      "Saúde diária",
      "data | passos | meta de passos | FC repouso | estresse médio | Body Battery mín–máx | minutos de intensidade moderados/vigorosos",
      days
        .filter((x) => x.hasData)
        .map((x) =>
          row([
            x.date,
            num(x.steps),
            num(x.stepGoal),
            num(x.restingHr),
            num(x.stressAvg),
            `${num(x.bodyBatteryMin)}–${num(x.bodyBatteryMax)}`,
            `${num(x.intensityModerate)}/${num(x.intensityVigorous)}`,
          ]),
        ),
    ),
    section(
      "Sono (cada noite na data em que acordou)",
      "data | dormiu | acordou | total h:mm | profundo | leve | REM | acordado | pontuação 0–100 | VFC noturna ms | necessidade de sono h:mm",
      nights
        .filter((n) => n.hasData)
        .map((n) =>
          row([
            n.date,
            time(n.startLocal),
            time(n.endLocal),
            clock(n.sleepSeconds, "hm"),
            clock(n.deepSeconds, "hm"),
            clock(n.lightSeconds, "hm"),
            clock(n.remSeconds, "hm"),
            clock(n.awakeSeconds, "hm"),
            num(n.score),
            num(n.hrvLastNight),
            clock(n.sleepNeedMinutes == null ? null : n.sleepNeedMinutes * 60, "hm"),
          ]),
        ),
    ),
  ].join("\n\n");
}
