import type { RunSummary } from "../api/runs";
import { trainingPaces } from "./daniels";
import { percentDelta } from "./delta";
import { formatDayMonth, formatDecimal, formatDuration, formatKm1, formatPace } from "./format";
import { BUCKETS, median, paceSeries, paceTrend } from "./pace";
import {
  BEST_DISTANCES,
  bestEfforts,
  efficiencySeries,
  efficiencyTrend,
  vdotFromRuns,
} from "./performance";
import { toIsoDate } from "./runStats";
import { heatBins, labelCounts, zoneShare } from "./training";
import { monthlyVolume, weeklyVolume } from "./volume";

export type InsightTone = "attention" | "positive" | "info";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  /** The numbers behind the observation, in plain language. */
  detail: string;
}

export interface InsightContext {
  /** Runs in the selected period, oldest first. */
  current: RunSummary[];
  /** Period start (YYYY-MM-DD); undefined = whole history. */
  from: string | undefined;
  /** Today (YYYY-MM-DD). */
  today: string;
  /** Rolling window used by the trend charts. */
  window: number;
  /** First day of the week (0 = Sunday); Monday when omitted. */
  weekStartsOn?: number;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const pace = (secPerKm: number) => formatPace(1000 / secPerKm);
const paceShort = (secPerKm: number) => pace(secPerKm).replace(" /km", "");

function shiftDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return toIsoDate(new Date(y!, m! - 1, d! + days));
}

function daysBetween(a: string, b: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return new Date(y!, m! - 1, d!).getTime();
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Share of HR time that was easy; needs ≥ 3 h of zone data. */
export function intensityInsight({ current }: InsightContext): Insight | null {
  const totalS = current.reduce((s, r) => s + (r.hrZonesS?.reduce((a, b) => a + b, 0) ?? 0), 0);
  const share = zoneShare(current);
  if (!share || totalS < 3 * 3600) return null;
  if (share.easy < 0.6) {
    return {
      id: "intensity",
      tone: "attention",
      title: "Pouco tempo em intensidade leve",
      detail: `Só ${pct(share.easy)} do seu tempo com FC foi leve (Z1–Z2) e ${pct(share.moderate)} ficou na Z3. A referência comum para evoluir com volume é ~80% leve: deixar as corridas leves realmente leves (Z2) tende a construir base aeróbica e a acelerar a recuperação para os treinos fortes.`,
    };
  }
  if (share.easy >= 0.75) {
    return {
      id: "intensity",
      tone: "positive",
      title: "Boa distribuição de intensidade",
      detail: `${pct(share.easy)} do seu tempo com FC foi leve (Z1–Z2), perto da referência comum de ~80% para quem treina por volume.`,
    };
  }
  return null;
}

const EASY_LABELS = new Set(["AEROBIC_BASE", "RECOVERY"]);
const EASY_MARGIN_S = 5;

/** Easy runs (or the typical run) vs the easy pace suggested by the period's VDOT. */
export function easyPaceInsight({ current }: InsightContext): Insight | null {
  const best = vdotFromRuns(current);
  if (!best) return null;
  const p = trainingPaces(best.value);
  const easyRange = `${paceShort(p.easy.fast)}–${pace(p.easy.slow)}`;
  const vdotText = `VDOT ${formatDecimal(best.value, 1)}`;
  const paceOf = (r: RunSummary) => (r.avgSpeedMps ? 1000 / r.avgSpeedMps : null);

  const easyPaces = current
    .filter((r) => r.trainingLabel && EASY_LABELS.has(r.trainingLabel))
    .map(paceOf)
    .filter((x): x is number => x != null);
  if (easyPaces.length >= 3) {
    const med = median(easyPaces);
    if (med >= p.easy.fast - EASY_MARGIN_S) return null;
    return {
      id: "easy-pace",
      tone: "attention",
      title: "Corridas de base mais rápidas que o ritmo leve",
      detail: `A mediana das suas ${easyPaces.length} corridas de base/recuperação foi ${pace(med)}. Para o seu ${vdotText}, o ritmo leve sugerido por Daniels é ${easyRange}.`,
    };
  }

  const all = current.map(paceOf).filter((x): x is number => x != null);
  if (all.length < 5) return null;
  const med = median(all);
  if (med >= p.easy.fast - EASY_MARGIN_S || med <= p.threshold) return null;
  return {
    id: "easy-pace",
    tone: "attention",
    title: "Sua corrida típica fica entre o leve e o limiar",
    detail: `A mediana das suas corridas foi ${pace(med)}: mais rápida que o ritmo leve (${easyRange}) e mais lenta que o limiar (${pace(p.threshold)}) sugeridos para o seu ${vdotText}. Essa "zona cinzenta" cansa mais que um treino leve e estimula menos que um treino de limiar.`,
  };
}

/** One training type dominating the period. */
export function monotonyInsight({ current }: InsightContext): Insight | null {
  const counts = labelCounts(current);
  const total = counts.reduce((s, c) => s + c.count, 0);
  const top = counts[0];
  if (!top || total < 8 || top.count / total <= 0.5) return null;
  return {
    id: "monotony",
    tone: "info",
    title: "Treinos muito parecidos",
    detail: `${top.count} de ${total} corridas (${pct(top.count / total)}) tiveram como efeito principal "${top.name}", segundo a Garmin. Alternar estímulos — longões leves, intervalados curtos — costuma trazer adaptações diferentes.`,
  };
}

/** Aerobic efficiency trend (needs two full windows of runs). */
export function efficiencyInsight({ current, window }: InsightContext): Insight | null {
  const points = efficiencySeries(current, window);
  const trend = efficiencyTrend(points, window);
  if (!trend || points.length < 2 * window) return null;
  const delta = percentDelta(trend.last, trend.first);
  const change = trend.last / trend.first - 1;
  if (!delta || Math.abs(change) < 0.03) return null;
  const numbers = `de ${formatDecimal(trend.first)} para ${formatDecimal(trend.last)} metros por batimento (${delta.text})`;
  return change > 0
    ? {
        id: "efficiency",
        tone: "positive",
        title: "Você está mais eficiente",
        detail: `Sua eficiência aeróbica subiu ${numbers}: você corre mais rápido com o mesmo esforço do coração.`,
      }
    : {
        id: "efficiency",
        tone: "attention",
        title: "Eficiência aeróbica caiu",
        detail: `Sua eficiência caiu ${numbers}. Calor, cansaço acumulado ou mais treinos intensos podem explicar — vale olhar a recuperação.`,
      };
}

/** Pace trend in the distance bucket with the most runs. */
export function paceTrendInsight({ current, window }: InsightContext): Insight | null {
  const trends = paceTrend(paceSeries(current, window), window)
    .filter((t) => t.count >= 2 * window)
    .sort((a, b) => b.count - a.count);
  const t = trends[0];
  if (!t) return null;
  const diff = t.lastSecPerKm - t.firstSecPerKm;
  if (Math.abs(diff) < 5) return null;
  const label = BUCKETS.find((b) => b.id === t.bucket)!.label.toLowerCase();
  const numbers = `${paceShort(t.firstSecPerKm)} → ${paceShort(t.lastSecPerKm)} /km (mediana das últimas ${window})`;
  return diff < 0
    ? {
        id: "pace-trend",
        tone: "positive",
        title: `Mais rápido nas corridas de ${label}`,
        detail: `Seu ritmo típico melhorou ${Math.round(-diff)} s/km no período: ${numbers}.`,
      }
    : {
        id: "pace-trend",
        tone: "info",
        title: `Mais lento nas corridas de ${label}`,
        detail: `Seu ritmo típico ficou ${Math.round(diff)} s/km mais lento: ${numbers}. Pode refletir mais corridas leves — o que não é ruim.`,
      };
}

const RECORD_DISTANCES = ["5000", "10000", "1000"] as const;
const OLD_RECORD_DAYS = 60;
const RECENT_DAYS = 30;
const CLOSE_TO_RECORD = 0.03;

/** Old personal bests in the period and how close the last 30 days came. */
export function recordsInsight({ current, today }: InsightContext): Insight | null {
  const bests = bestEfforts(current);
  const distance = RECORD_DISTANCES.find((d) => bests[d]);
  if (!distance) return null;
  const best = bests[distance]!;
  if (daysBetween(best.startLocal, today) < OLD_RECORD_DAYS) return null;
  const label = BEST_DISTANCES.find((d) => d.id === distance)!.label;
  const record = `${formatDuration(best.seconds)} (${formatDayMonth(best.startLocal)})`;
  const since = shiftDays(today, -RECENT_DAYS);
  const recent = bestEfforts(current.filter((r) => r.startLocal.slice(0, 10) >= since))[distance];
  if (!recent) {
    return {
      id: "records",
      tone: "info",
      title: `Recorde de ${label} segue de pé`,
      detail: `Seu melhor ${label} no período é ${record}, e não houve esforço de ${label} nos últimos ${RECENT_DAYS} dias.`,
    };
  }
  const gap = recent.seconds / best.seconds - 1;
  const recentText = `${formatDuration(recent.seconds)} em ${formatDayMonth(recent.startLocal)}`;
  return gap <= CLOSE_TO_RECORD
    ? {
        id: "records",
        tone: "positive",
        title: `Perto do recorde de ${label}`,
        detail: `Você fez ${recentText}, a ${formatDecimal(gap * 100, 1)}% do seu melhor ${label}, ${record}.`,
      }
    : {
        id: "records",
        tone: "info",
        title: `Recorde de ${label} segue de pé`,
        detail: `Seu melhor ${label} é ${record}; o melhor dos últimos ${RECENT_DAYS} dias foi ${recentText} (+${formatDecimal(gap * 100, 1)}%).`,
      };
}

/** Weeks fully in the past (Mon–Sun before today). */
function completeWeeks(ctx: InsightContext) {
  return weeklyVolume(ctx.current, ctx.from, ctx.today, ctx.weekStartsOn).filter(
    (w) => shiftDays(w.weekStart, 6) < ctx.today,
  );
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Sharp volume increases: last 4 weeks vs the 4 before, and last week vs its 4 predecessors. */
export function volumeRampInsight(ctx: InsightContext): Insight | null {
  const weeks = completeWeeks(ctx);
  if (weeks.length < 8) return null;
  const last4 = avg(weeks.slice(-4).map((w) => w.km));
  const prev4 = avg(weeks.slice(-8, -4).map((w) => w.km));
  if (prev4 < 5) return null;
  const ratio = last4 / prev4;
  const caution =
    "Aumentos graduais (≈10% por semana é uma referência comum) reduzem o risco de lesão.";
  if (ratio > 1.3) {
    return {
      id: "volume-ramp",
      tone: "attention",
      title: "Volume subiu rápido",
      detail: `Média de ${formatKm1(last4)}/semana nas últimas 4 semanas, contra ${formatKm1(prev4)} nas 4 anteriores (+${Math.round((ratio - 1) * 100)}%). ${caution}`,
    };
  }
  const lastWeek = weeks.at(-1)!;
  const before = avg(weeks.slice(-5, -1).map((w) => w.km));
  if (before >= 5 && lastWeek.km > 1.5 * before) {
    return {
      id: "volume-ramp",
      tone: "attention",
      title: "Semana bem acima do normal",
      detail: `A semana de ${formatDayMonth(lastWeek.weekStart)} teve ${formatKm1(lastWeek.km)}, contra média de ${formatKm1(before)} nas 4 anteriores. ${caution}`,
    };
  }
  if (ratio < 0.6) {
    return {
      id: "volume-ramp",
      tone: "info",
      title: "Volume caiu",
      detail: `Média de ${formatKm1(last4)}/semana nas últimas 4 semanas, contra ${formatKm1(prev4)} nas 4 anteriores.`,
    };
  }
  return null;
}

/** Current streak of weeks with runs, or the longest break in the period. */
export function consistencyInsight(ctx: InsightContext): Insight | null {
  const weeks = weeklyVolume(ctx.current, ctx.from, ctx.today, ctx.weekStartsOn);
  const firstRun = weeks.findIndex((w) => w.runs > 0);
  if (firstRun < 0) return null;
  const relevant = weeks.slice(firstRun);
  // The ongoing week only counts toward the streak once it has a run.
  const ended = relevant.at(-1)!.runs > 0 ? relevant : relevant.slice(0, -1);
  let streak = 0;
  for (let i = ended.length - 1; i >= 0 && ended[i]!.runs > 0; i--) streak++;
  if (streak >= 6) {
    return {
      id: "consistency",
      tone: "positive",
      title: `${streak} semanas seguidas correndo`,
      detail: `Você correu em todas as últimas ${streak} semanas. Constância é o que mais pesa na evolução.`,
    };
  }
  let longest = { length: 0, start: "" };
  let run = { length: 0, start: "" };
  for (const w of ended) {
    if (w.runs === 0) {
      run = run.length
        ? { length: run.length + 1, start: run.start }
        : { length: 1, start: w.weekStart };
      if (run.length > longest.length) longest = run;
    } else run = { length: 0, start: "" };
  }
  if (longest.length < 2) return null;
  return {
    id: "consistency",
    tone: "info",
    title: "Houve uma pausa no período",
    detail: `${longest.length} semanas sem corridas a partir de ${formatDayMonth(longest.start)}. Na volta de uma pausa, retomar o volume aos poucos ajuda a evitar lesões.`,
  };
}

/** Pace cost of heat: median pace in the hottest vs coolest band with ≥ 3 runs each. */
export function heatInsight({ current }: InsightContext): Insight | null {
  const bins = heatBins(current, 2).filter((b) => b.count >= 3);
  if (bins.length < 2) return null;
  const cool = bins[0]!;
  const hot = bins.at(-1)!;
  const diff = Math.round(hot.medianSecPerKm - cool.medianSecPerKm);
  if (diff < 8) return null;
  return {
    id: "heat",
    tone: "info",
    title: "O calor pesa no seu ritmo",
    detail: `Mediana de ${pace(hot.medianSecPerKm)} entre ${hot.fromC}–${hot.toC} °C contra ${pace(cool.medianSecPerKm)} entre ${cool.fromC}–${cool.toC} °C: cerca de ${diff} s/km. Leve isso em conta ao comparar treinos e escolher horários.`,
  };
}

// ——— R9: training-structure rules ———

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const paceOf = (r: RunSummary) => (r.avgSpeedMps ? 1000 / r.avgSpeedMps : null);
const pacesOf = (runs: RunSummary[]) => runs.map(paceOf).filter((x): x is number => x != null);
const hourOf = (r: RunSummary) => Number(r.startLocal.slice(11, 13));

/** Morning (before 10h) vs evening (from 17h) median pace, ≥ 4 runs each. */
export function timeOfDayInsight({ current }: InsightContext): Insight | null {
  const morning = pacesOf(current.filter((r) => hourOf(r) < 10));
  const evening = pacesOf(current.filter((r) => hourOf(r) >= 17));
  if (morning.length < 4 || evening.length < 4) return null;
  const m = median(morning);
  const e = median(evening);
  const diff = Math.round(e - m);
  if (Math.abs(diff) < 8) return null;
  return {
    id: "time-of-day",
    tone: "info",
    title: `Você corre mais rápido ${diff > 0 ? "de manhã" : "à noite"}`,
    detail: `Mediana de ${pace(m)} de manhã (antes das 10h, ${morning.length} corridas) contra ${pace(e)} à noite (depois das 17h, ${evening.length}): cerca de ${Math.abs(diff)} s/km de diferença. Temperatura e o tipo de treino de cada horário também influenciam.`,
  };
}

const isTreadmill = (r: RunSummary) => /treadmill|indoor/.test(r.type);

/** Treadmill vs outdoor median pace, ≥ 3 runs each. */
export function treadmillInsight({ current }: InsightContext): Insight | null {
  const tread = pacesOf(current.filter(isTreadmill));
  const road = pacesOf(current.filter((r) => !isTreadmill(r)));
  if (tread.length < 3 || road.length < 3) return null;
  const diff = Math.round(median(road) - median(tread));
  if (Math.abs(diff) < 10) return null;
  return {
    id: "treadmill",
    tone: "info",
    title: "Esteira e rua têm ritmos diferentes",
    detail: `Mediana de ${pace(median(tread))} na esteira e ${pace(median(road))} na rua: cerca de ${Math.abs(diff)} s/km mais ${diff > 0 ? "rápido" : "lento"} na esteira. O ritmo da esteira depende da calibração do relógio, então compare cada tipo com ele mesmo.`,
  };
}

/** Long run (longest of each week) growth, or too much of the week in one run. */
export function longRunInsight(ctx: InsightContext): Insight | null {
  const weeks = completeWeeks(ctx);
  if (weeks.length < 8) return null;
  const active = (ws: typeof weeks) => ws.filter((w) => w.runs > 0);
  const last4 = active(weeks.slice(-4));
  const prev4 = active(weeks.slice(-8, -4));
  if (last4.length < 3 || prev4.length < 3) return null;
  const lastLong = avg(last4.map((w) => w.longestKm));
  const prevLong = avg(prev4.map((w) => w.longestKm));
  if (prevLong >= 3 && lastLong >= prevLong * 1.25) {
    return {
      id: "long-run",
      tone: "positive",
      title: "Seu longão está crescendo",
      detail: `A maior corrida de cada semana passou de ${formatKm1(prevLong)} para ${formatKm1(lastLong)} em média (4 semanas anteriores → últimas 4).`,
    };
  }
  const multi = last4.filter((w) => w.runs >= 2);
  const share = multi.length >= 3 ? avg(multi.map((w) => w.longestKm / w.km)) : 0;
  if (share > 0.5) {
    return {
      id: "long-run",
      tone: "info",
      title: "O longão concentra muito do volume",
      detail: `Nas últimas 4 semanas, a maior corrida foi em média ${pct(share)} da distância da semana. Distribuir melhor o volume deixa o longão menos desgastante.`,
    };
  }
  return null;
}

const HARD_LABELS = new Set([
  "TEMPO",
  "LACTATE_THRESHOLD",
  "VO2MAX",
  "ANAEROBIC_CAPACITY",
  "SPEED",
]);

/** Hard sessions on back-to-back days. */
export function hardSpacingInsight({ current }: InsightContext): Insight | null {
  const hard = (r: RunSummary) => r.trainingLabel != null && HARD_LABELS.has(r.trainingLabel);
  let pairs = 0;
  for (let i = 1; i < current.length; i++) {
    const a = current[i - 1]!;
    const b = current[i]!;
    if (hard(a) && hard(b) && daysBetween(a.startLocal, b.startLocal) === 1) pairs++;
  }
  if (pairs < 2) return null;
  return {
    id: "hard-spacing",
    tone: "attention",
    title: "Treinos fortes em dias seguidos",
    detail: `Em ${pairs} vezes no período você fez treinos intensos (tempo, limiar ou VO2, segundo a Garmin) em dois dias seguidos. Intercalar com um dia leve ou de descanso ajuda o corpo a absorver o treino.`,
  };
}

/** Almost no anaerobic training effect across ≥ 10 runs. */
export function anaerobicInsight({ current }: InsightContext): Insight | null {
  const withTe = current.filter((r) => r.anaerobicTe != null);
  if (withTe.length < 10) return null;
  const some = withTe.filter((r) => r.anaerobicTe! >= 1).length;
  if (some / withTe.length >= 0.1) return null;
  return {
    id: "anaerobic",
    tone: "info",
    title: "Quase nenhum estímulo anaeróbico",
    detail: `Só ${some} de ${withTe.length} corridas tiveram efeito anaeróbico de 1,0 ou mais, segundo a Garmin. Tiros curtos e rápidos (ex.: 8 × 200 m) trabalham velocidade e economia de corrida.`,
  };
}

const FLAT_GAIN_M = 30;

/** Nearly all runs flat (< 30 m of climb) across ≥ 10 runs. */
export function elevationInsight({ current }: InsightContext): Insight | null {
  const withGain = current.filter((r) => r.elevationGainM != null);
  if (withGain.length < 10) return null;
  const flat = withGain.filter((r) => r.elevationGainM! < FLAT_GAIN_M).length;
  if (flat / withGain.length < 0.85) return null;
  return {
    id: "elevation",
    tone: "info",
    title: "Quase todas as corridas são planas",
    detail: `${flat} de ${withGain.length} corridas tiveram menos de ${FLAT_GAIN_M} m de subida. Incluir subidas de vez em quando trabalha força e economia de corrida.`,
  };
}

/** Biggest month by distance (needs ≥ 3 months of history). */
export function bestMonthInsight({ current, today }: InsightContext): Insight | null {
  const months = monthlyVolume(current, undefined, today);
  if (months.length < 3) return null;
  const best = months.reduce((a, b) => (b.km > a.km ? b : a));
  if (best.km === 0) return null;
  const thisMonth = today.slice(0, 7);
  const lastMonth = shiftDays(`${thisMonth}-01`, -1).slice(0, 7);
  const recent = best.month === thisMonth || best.month === lastMonth;
  const name = MONTHS_PT[Number(best.month.slice(5, 7)) - 1];
  return {
    id: "best-month",
    tone: recent ? "positive" : "info",
    title: `Seu maior mês: ${name}`,
    detail: `${formatKm1(best.km)} em ${best.runs} corridas — o maior volume mensal do período.`,
  };
}

/** Runs per week since the first run (≥ 4 complete weeks): praise ≥ 4, note < 2. */
export function frequencyInsight(ctx: InsightContext): Insight | null {
  const weeks = weeklyVolume(ctx.current, undefined, ctx.today, ctx.weekStartsOn).filter(
    (w) => shiftDays(w.weekStart, 6) < ctx.today,
  );
  if (weeks.length < 4) return null;
  const perWeek = avg(weeks.map((w) => w.runs));
  const n = formatDecimal(perWeek, 1);
  if (perWeek >= 4) {
    return {
      id: "frequency",
      tone: "positive",
      title: "Alta frequência de treino",
      detail: `Você corre em média ${n} vezes por semana.`,
    };
  }
  if (perWeek < 2) {
    return {
      id: "frequency",
      tone: "info",
      title: "Poucas corridas por semana",
      detail: `Você corre em média ${n} ${perWeek < 1.5 ? "vez" : "vezes"} por semana. Somar uma corrida leve curta por semana costuma acelerar a evolução sem muito desgaste.`,
    };
  }
  return null;
}

const RULES = [
  intensityInsight,
  easyPaceInsight,
  volumeRampInsight,
  efficiencyInsight,
  paceTrendInsight,
  recordsInsight,
  consistencyInsight,
  monotonyInsight,
  heatInsight,
  hardSpacingInsight,
  longRunInsight,
  bestMonthInsight,
  frequencyInsight,
  timeOfDayInsight,
  treadmillInsight,
  anaerobicInsight,
  elevationInsight,
];

const TONE_ORDER: Record<InsightTone, number> = { attention: 0, positive: 1, info: 2 };
export const MAX_INSIGHTS = 6;

/** All rules that fire, attention first, then positive, then info; at most MAX_INSIGHTS. */
export function generateInsights(ctx: InsightContext): Insight[] {
  return RULES.map((rule) => rule(ctx))
    .filter((i): i is Insight => i !== null)
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
    .slice(0, MAX_INSIGHTS);
}
