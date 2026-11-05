import type { HealthDay, SleepNight } from "../api/wellness";
import { formatTotalTime } from "./format";
import type { Insight } from "./insights";
import { median } from "./pace";

const EVENING_START = 18 * 60;

/** Minutes after 18:00 of a "YYYY-MM-DDTHH:mm" time, so 23:30 and 01:15 stay comparable. */
export function bedtimeMinutes(local: string | null): number | null {
  if (!local) return null;
  const minutes = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  return (minutes - EVENING_START + 1440) % 1440;
}

const clock = (afterSix: number) => {
  const m = Math.round(afterSix + EVENING_START) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (x: number) => `${Math.round(x * 100)}%`;

type Night = SleepNight & { totalS: number; date: string };

function nightsOf(days: HealthDay[]): Night[] {
  return days.flatMap((d) =>
    d.sleep?.totalS ? [{ ...d.sleep, totalS: d.sleep.totalS, date: d.date }] : [],
  );
}

export interface SleepStats {
  nights: number;
  avgTotalS: number;
  avgScore: number | null;
  shareAtLeast7h: number;
  /** "HH:mm" */
  avgBedtime: string | null;
  deepShare: number | null;
  remShare: number | null;
}

export function sleepStats(days: HealthDay[]): SleepStats | null {
  const nights = nightsOf(days);
  if (nights.length === 0) return null;
  const total = nights.reduce((s, n) => s + n.totalS, 0);
  const scores = nights.map((n) => n.score).filter((x): x is number => x != null);
  const beds = nights
    .map((n) => bedtimeMinutes(n.startLocal))
    .filter((x): x is number => x != null);
  const sumOf = (k: "deepS" | "remS") => nights.reduce((s, n) => s + (n[k] ?? 0), 0);
  return {
    nights: nights.length,
    avgTotalS: total / nights.length,
    avgScore: scores.length ? Math.round(mean(scores)) : null,
    shareAtLeast7h: nights.filter((n) => n.totalS >= 7 * 3600).length / nights.length,
    avgBedtime: beds.length ? clock(mean(beds)) : null,
    deepShare: total ? sumOf("deepS") / total : null,
    remShare: total ? sumOf("remS") / total : null,
  };
}

const MIN_NIGHTS = 7;
const WINDOW = 7;

/** Observations about sleep across the selected nights (needs ≥ 7 nights). */
export function sleepInsights(days: HealthDay[]): Insight[] {
  const nights = nightsOf(days);
  const stats = sleepStats(days);
  if (!stats || nights.length < MIN_NIGHTS) return [];
  const out: Insight[] = [];
  const hours = stats.avgTotalS / 3600;

  if (hours < 7) {
    out.push({
      id: "sleep-average",
      tone: "attention",
      title: "Você dorme pouco, em média",
      detail: `Média de ${formatTotalTime(stats.avgTotalS)} por noite. A recomendação comum para adultos é de 7 a 9 h — e quem treina costuma precisar do lado alto da faixa.`,
    });
  } else if (hours >= 7.5) {
    out.push({
      id: "sleep-average",
      tone: "positive",
      title: "Boa média de sono",
      detail: `Média de ${formatTotalTime(stats.avgTotalS)} por noite.`,
    });
  }

  const short = nights.filter((n) => n.totalS < 6 * 3600).length;
  if (short / nights.length > 0.3) {
    out.push({
      id: "short-nights",
      tone: "attention",
      title: "Muitas noites curtas",
      detail: `${short} de ${nights.length} noites tiveram menos de 6 h de sono.`,
    });
  }

  const beds = nights
    .map((n) => bedtimeMinutes(n.startLocal))
    .filter((x): x is number => x != null);
  if (beds.length >= MIN_NIGHTS) {
    const avg = mean(beds);
    const sd = Math.sqrt(mean(beds.map((b) => (b - avg) ** 2)));
    if (sd > 60) {
      const sorted = [...beds].sort((a, b) => a - b);
      const lo = sorted[Math.floor(sorted.length * 0.1)]!;
      const hi = sorted[Math.ceil(sorted.length * 0.9) - 1]!;
      out.push({
        id: "bedtime",
        tone: "info",
        title: "Horário de dormir irregular",
        detail: `Você costuma deitar entre ${clock(lo)} e ${clock(hi)} (variação típica de ±${Math.round(sd)} min). Horários regulares ajudam o corpo a pegar no sono e a se recuperar.`,
      });
    } else if (sd <= 30) {
      out.push({
        id: "bedtime",
        tone: "positive",
        title: "Horário de dormir regular",
        detail: `Você deita perto das ${clock(avg)} quase todo dia (±${Math.round(sd)} min).`,
      });
    }
  }

  if (stats.deepShare != null && stats.deepShare < 0.16) {
    out.push({
      id: "deep",
      tone: "info",
      title: "Pouco sono profundo",
      detail: `${pct(stats.deepShare)} do sono foi profundo; a faixa típica da Garmin é de 16% a 33%. Álcool, refeições tarde e treinos intensos à noite costumam reduzir o sono profundo.`,
    });
  }
  if (stats.remShare != null && stats.remShare < 0.18) {
    out.push({
      id: "rem",
      tone: "info",
      title: "Pouco sono REM",
      detail: `${pct(stats.remShare)} do sono foi REM; a faixa típica da Garmin é de 21% a 31%. O REM se concentra no fim da noite — dormir pouco corta justamente ele.`,
    });
  }

  const dow = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
  const weekend = nights.filter((n) => [0, 6].includes(dow(n.date))).map((n) => n.totalS);
  const weekday = nights.filter((n) => ![0, 6].includes(dow(n.date))).map((n) => n.totalS);
  if (weekend.length >= 2 && weekday.length >= 4) {
    const diff = mean(weekend) - mean(weekday);
    if (diff >= 45 * 60) {
      out.push({
        id: "weekend",
        tone: "info",
        title: "Você compensa o sono no fim de semana",
        detail: `Nas noites de sexta e sábado você dorme ${formatTotalTime(diff)} a mais que nos dias úteis — sinal de sono acumulado durante a semana.`,
      });
    }
  }

  const scores = nights.map((n) => n.score).filter((x): x is number => x != null);
  if (scores.length >= 2 * WINDOW) {
    const first = median(scores.slice(0, WINDOW));
    const last = median(scores.slice(-WINDOW));
    if (last - first >= 5) {
      out.push({
        id: "score-trend",
        tone: "positive",
        title: "Sua nota de sono melhorou",
        detail: `Mediana das primeiras ${WINDOW} noites: ${first}; das últimas ${WINDOW}: ${last}.`,
      });
    } else if (first - last >= 5) {
      out.push({
        id: "score-trend",
        tone: "attention",
        title: "Sua nota de sono caiu",
        detail: `Mediana das primeiras ${WINDOW} noites: ${first}; das últimas ${WINDOW}: ${last}.`,
      });
    }
  }

  const order = { attention: 0, positive: 1, info: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
