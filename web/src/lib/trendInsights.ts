import type { DayPoint } from "../api/daily";
import type { Night } from "../api/sleep";
import { formatTotalTime } from "./format";
import type { Insight, InsightTone } from "./insights";

export interface TrendContext {
  /** Every day of the period, oldest first (days without data included). */
  days: DayPoint[];
  /** Every night of the same period, oldest first. */
  nights: Night[];
}

type Value = number | null;

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = (share: number) => `${Math.round(share * 100)}%`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const present = (values: Value[]) => values.filter((v): v is number => v != null);
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const weekdayOf = (date: string) => new Date(`${date}T12:00Z`).getUTCDay();
/** "aos sábados" / "às segundas": sábado and domingo are masculine. */
const onWeekday = (w: number) => `${w === 0 || w === 6 ? "aos" : "às"} ${WEEKDAYS[w]}s`;

const dayValues = ({ days }: TrendContext, pick: (d: DayPoint) => Value) =>
  days.map((d) => (d.hasData ? pick(d) : null));
const nightValues = ({ nights }: TrendContext, pick: (n: Night) => Value) =>
  nights.map((n) => (n.hasData ? pick(n) : null));

/** Last 7 days vs the rest of the period; needs ≥ 21 days, 4 recent values and 7 before. */
function lastWeekVsBefore(values: Value[]): { last: number; before: number } | null {
  if (values.length < 21) return null;
  const last = present(values.slice(-7));
  const before = present(values.slice(0, -7));
  if (last.length < 4 || before.length < 7) return null;
  return { last: mean(last), before: mean(before) };
}

const versus = (last: string, before: string) =>
  `${last} na última semana contra ${before} no restante do período.`;

export function restingHrTrendInsight(ctx: TrendContext): Insight | null {
  const t = lastWeekVsBefore(dayValues(ctx, (d) => d.restingHr));
  if (!t) return null;
  const diff = Math.round(t.last - t.before);
  const numbers = versus(`${int.format(t.last)} bpm`, `${int.format(t.before)} bpm`);
  if (diff >= 2) {
    return {
      id: "trend-resting-hr",
      tone: "attention",
      title: `FC em repouso subindo (${signed(diff)} bpm)`,
      detail: `${numbers} Uma alta sustentada costuma acompanhar carga de treino acumulada, sono curto, estresse ou o começo de uma doença.`,
    };
  }
  if (diff <= -2) {
    return {
      id: "trend-resting-hr",
      tone: "positive",
      title: `FC em repouso caindo (${signed(diff)} bpm)`,
      detail: `${numbers} Queda gradual costuma refletir melhora de condicionamento e boa recuperação.`,
    };
  }
  return null;
}

export function hrvTrendInsight(ctx: TrendContext): Insight | null {
  const t = lastWeekVsBefore(nightValues(ctx, (n) => n.hrvLastNight));
  if (!t) return null;
  const ratio = t.last / t.before;
  const numbers = versus(`${int.format(t.last)} ms`, `${int.format(t.before)} ms`);
  if (ratio <= 0.92) {
    return {
      id: "trend-hrv",
      tone: "attention",
      title: `VFC noturna em queda (${pct(ratio - 1)})`,
      detail: `${numbers} Queda de VFC por vários dias costuma indicar que o corpo está lidando com mais carga do que recupera.`,
    };
  }
  if (ratio >= 1.08) {
    return {
      id: "trend-hrv",
      tone: "positive",
      title: `VFC noturna em alta (+${pct(ratio - 1)})`,
      detail: numbers,
    };
  }
  return null;
}

export function stepsTrendInsight(ctx: TrendContext): Insight | null {
  const t = lastWeekVsBefore(dayValues(ctx, (d) => d.steps));
  if (!t || t.before === 0) return null;
  const ratio = t.last / t.before;
  const numbers = versus(`${int.format(t.last)} passos/dia`, `${int.format(t.before)}`);
  if (ratio >= 1.2) {
    return {
      id: "trend-steps",
      tone: "positive",
      title: `Última semana mais ativa (+${pct(ratio - 1)} de passos)`,
      detail: numbers,
    };
  }
  if (ratio <= 0.8) {
    return {
      id: "trend-steps",
      tone: "info",
      title: `Última semana mais parada (${pct(ratio - 1)} de passos)`,
      detail: numbers,
    };
  }
  return null;
}

export function stressTrendInsight(ctx: TrendContext): Insight | null {
  const t = lastWeekVsBefore(dayValues(ctx, (d) => d.stressAvg));
  if (!t) return null;
  const diff = Math.round(t.last - t.before);
  const numbers = versus(`Estresse médio de ${int.format(t.last)}`, int.format(t.before));
  if (diff >= 5) {
    return {
      id: "trend-stress",
      tone: "attention",
      title: `Semana mais estressante (${signed(diff)} pontos)`,
      detail: numbers,
    };
  }
  if (diff <= -5) {
    return {
      id: "trend-stress",
      tone: "positive",
      title: `Semana mais tranquila (${signed(diff)} pontos)`,
      detail: numbers,
    };
  }
  return null;
}

export function bodyBatteryTrendInsight(ctx: TrendContext): Insight | null {
  const t = lastWeekVsBefore(dayValues(ctx, (d) => d.bodyBatteryMax));
  if (!t) return null;
  const diff = Math.round(t.last - t.before);
  const numbers = versus(
    `Pico médio de Body Battery de ${int.format(t.last)}`,
    int.format(t.before),
  );
  if (diff <= -8) {
    return {
      id: "trend-bb",
      tone: "attention",
      title: `Body Battery recarregando menos (${signed(diff)})`,
      detail: `${numbers} O pico vem do sono: uma queda assim em geral acompanha noites mais curtas ou agitadas.`,
    };
  }
  if (diff >= 8) {
    return {
      id: "trend-bb",
      tone: "positive",
      title: `Body Battery recarregando mais (${signed(diff)})`,
      detail: numbers,
    };
  }
  return null;
}

/** Mean per weekday (0 = Sunday), only for weekdays with ≥ 3 values. */
function byWeekday(dates: string[], values: Value[]): Map<number, number> {
  const groups = new Map<number, number[]>();
  dates.forEach((date, i) => {
    const v = values[i];
    if (v == null) return;
    const w = weekdayOf(date);
    groups.set(w, [...(groups.get(w) ?? []), v]);
  });
  return new Map([...groups].filter(([, vs]) => vs.length >= 3).map(([w, vs]) => [w, mean(vs)]));
}

function extremes(means: Map<number, number>) {
  const sorted = [...means].sort((a, b) => a[1] - b[1]);
  return { min: sorted[0]!, max: sorted.at(-1)! };
}

export function stepsWeekdayInsight(ctx: TrendContext): Insight | null {
  if (ctx.days.length < 28) return null;
  const means = byWeekday(
    ctx.days.map((d) => d.date),
    dayValues(ctx, (d) => d.steps),
  );
  if (means.size < 7) return null;
  const { min, max } = extremes(means);
  if (min[1] <= 0 || max[1] / min[1] < 1.3) return null;
  return {
    id: "trend-steps-weekday",
    tone: "info",
    title: `Seu dia mais ativo é ${WEEKDAYS[max[0]]}`,
    detail: `Média de ${int.format(max[1])} passos ${onWeekday(max[0])}; o dia mais parado é ${WEEKDAYS[min[0]]}, com ${int.format(min[1])}.`,
  };
}

export function sleepWeekdayInsight(ctx: TrendContext): Insight | null {
  if (ctx.nights.length < 28) return null;
  const values = nightValues(ctx, (n) => n.sleepSeconds);
  const means = byWeekday(
    ctx.nights.map((n) => n.date),
    values,
  );
  if (means.size < 7) return null;
  const overall = mean(present(values));
  const { min } = extremes(means);
  if (overall - min[1] < 45 * 60) return null;
  const wake = WEEKDAYS[min[0]]!;
  const before = WEEKDAYS[(min[0] + 6) % 7]!;
  return {
    id: "trend-sleep-weekday",
    tone: "info",
    title: `Sua noite mais curta é de ${before} para ${wake}`,
    detail: `Média de ${formatTotalTime(min[1])} nessa noite contra ${formatTotalTime(overall)} na média de todas as noites do período.`,
  };
}

export function stepGoalRateInsight(ctx: TrendContext): Insight | null {
  const days = ctx.days.filter((d) => d.hasData && d.steps != null && d.stepGoal);
  if (days.length < 14) return null;
  const hit = days.filter((d) => d.steps! >= d.stepGoal!).length;
  const rate = hit / days.length;
  return {
    id: "trend-step-goal",
    tone: rate >= 0.7 ? "positive" : "info",
    title: `Meta de passos batida em ${hit} de ${days.length} dias`,
    detail: `${pct(rate)} dos dias com dados no período. A meta da Garmin se ajusta sozinha ao que você vem fazendo.`,
  };
}

export function shortNightNextDayInsight(ctx: TrendContext): Insight | null {
  const dayByDate = new Map(ctx.days.filter((d) => d.hasData).map((d) => [d.date, d]));
  const pairs = ctx.nights
    .filter((n) => n.hasData && n.sleepSeconds != null)
    .map((n) => ({ sleep: n.sleepSeconds!, day: dayByDate.get(n.date) }))
    .filter((p): p is { sleep: number; day: DayPoint } => p.day != null);
  const short = pairs.filter((p) => p.sleep < 6 * 3600).map((p) => p.day);
  const good = pairs.filter((p) => p.sleep >= 7 * 3600).map((p) => p.day);
  if (short.length < 3 || good.length < 3) return null;
  const avg = (ds: DayPoint[], pick: (d: DayPoint) => Value) => {
    const v = present(ds.map(pick));
    return v.length ? mean(v) : null;
  };
  const bbShort = avg(short, (d) => d.bodyBatteryMax);
  const bbGood = avg(good, (d) => d.bodyBatteryMax);
  const hrShort = avg(short, (d) => d.restingHr);
  const hrGood = avg(good, (d) => d.restingHr);
  const bbGap = bbShort != null && bbGood != null ? bbGood - bbShort : 0;
  const hrGap = hrShort != null && hrGood != null ? Math.round(hrShort - hrGood) : 0;
  if (bbGap < 8 && hrGap < 2) return null;
  const bb =
    bbShort != null && bbGood != null
      ? `O Body Battery máximo ficou em média em ${int.format(bbShort)} depois de noites com menos de 6 h (${short.length} dias) e, depois de noites de 7 h ou mais (${good.length} dias), em ${int.format(bbGood)}.`
      : "";
  const hr =
    hrGap !== 0 ? ` A FC em repouso ficou ${signed(hrGap)} bpm em relação às noites boas.` : "";
  return {
    id: "trend-short-night",
    tone: "info",
    title: "Noites curtas aparecem no dia seguinte",
    detail: `${bb}${hr}`.trim(),
  };
}

const RULES = [
  restingHrTrendInsight,
  hrvTrendInsight,
  bodyBatteryTrendInsight,
  stressTrendInsight,
  stepsTrendInsight,
  shortNightNextDayInsight,
  stepGoalRateInsight,
  stepsWeekdayInsight,
  sleepWeekdayInsight,
];

const TONE_ORDER: Record<InsightTone, number> = { attention: 0, positive: 1, info: 2 };

/** Every observation the period supports, attention first. */
export function generateTrendInsights(ctx: TrendContext): Insight[] {
  if (!ctx.days.some((d) => d.hasData) && !ctx.nights.some((n) => n.hasData)) return [];
  return RULES.map((rule) => rule(ctx))
    .filter((i): i is Insight => i != null)
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
