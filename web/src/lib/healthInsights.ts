import type { DayPoint } from "../api/daily";
import { intensityMinutes, shiftDate } from "./health";
import type { Insight, InsightTone } from "./insights";
import { median } from "./pace";

export interface HealthContext {
  /** The day being looked at. */
  day: DayPoint;
  /** Days before `day` (usually the last 30); days without data are ignored. */
  history: DayPoint[];
  /** Today (YYYY-MM-DD): a day that has not ended yet is not judged on totals. */
  today: string;
  /** First day of the week (0 = Sunday, 1 = Monday). */
  weekStartsOn: number;
}

/** Days of history needed before comparing with "your usual". */
const MIN_HISTORY = 7;

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = (share: number) => `${Math.round(share * 100)}%`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const isFinished = ({ day, today }: HealthContext) => day.date < today;

/** Median of a metric over the history days that have it, or null below MIN_HISTORY. */
function usual(ctx: HealthContext, pick: (d: DayPoint) => number | null): number | null {
  const values = ctx.history
    .filter((d) => d.hasData)
    .map(pick)
    .filter((v): v is number => v != null);
  return values.length >= MIN_HISTORY ? median(values) : null;
}

const historyDays = (ctx: HealthContext) => ctx.history.filter((d) => d.hasData).length;

export function restingHrInsight(ctx: HealthContext): Insight | null {
  const hr = ctx.day.restingHr;
  const base = usual(ctx, (d) => d.restingHr);
  if (hr == null || base == null) return null;
  const diff = Math.round(hr - base);
  const numbers = `${hr} bpm contra a sua mediana de ${int.format(base)} bpm nos últimos ${historyDays(ctx)} dias (${signed(diff)} bpm).`;
  if (diff >= 3) {
    return {
      id: "health-resting-hr",
      tone: "attention",
      title: "FC em repouso acima do seu normal",
      detail: `${numbers} Uma alta de alguns bpm costuma acompanhar sono curto, estresse, treino intenso, álcool ou o início de um resfriado; vale observar se continua nos próximos dias.`,
    };
  }
  if (diff <= -3) {
    return {
      id: "health-resting-hr",
      tone: "positive",
      title: "FC em repouso abaixo do seu normal",
      detail: `${numbers} Uma FC de repouso mais baixa que a habitual costuma indicar boa recuperação.`,
    };
  }
  return {
    id: "health-resting-hr",
    tone: "info",
    title: "FC em repouso no seu padrão",
    detail: numbers,
  };
}

export function bodyBatteryPeakInsight(ctx: HealthContext): Insight | null {
  const peak = ctx.day.bodyBatteryMax;
  const base = usual(ctx, (d) => d.bodyBatteryMax);
  if (peak == null || base == null) return null;
  const numbers = `Pico de ${peak} contra o seu pico típico de ${int.format(base)}.`;
  if (peak <= base - 15) {
    return {
      id: "health-bb-peak",
      tone: "attention",
      title: "Body Battery recarregou menos que o normal",
      detail: `${numbers} O pico costuma vir depois do sono; um pico baixo em geral reflete uma noite curta ou agitada, ou um dia anterior muito desgastante.`,
    };
  }
  if (peak >= base + 10) {
    return {
      id: "health-bb-peak",
      tone: "positive",
      title: "Body Battery recarregou acima do normal",
      detail: `${numbers} Sinal de uma noite que recuperou bem.`,
    };
  }
  return null;
}

export function bodyBatteryBalanceInsight(ctx: HealthContext): Insight | null {
  const { bodyBatteryCharged: charged, bodyBatteryDrained: drained } = ctx.day;
  if (!isFinished(ctx) || charged == null || drained == null) return null;
  const numbers = `Recarregou ${charged} e gastou ${drained} ao longo do dia.`;
  if (drained - charged >= 15) {
    return {
      id: "health-bb-balance",
      tone: "attention",
      title: "Dia gastou mais energia do que recuperou",
      detail: `${numbers} Dias assim seguidos tendem a baixar o Body Battery de partida das manhãs seguintes.`,
    };
  }
  if (charged - drained >= 10) {
    return {
      id: "health-bb-balance",
      tone: "positive",
      title: "Dia recuperou mais energia do que gastou",
      detail: numbers,
    };
  }
  return null;
}

export function stressInsight(ctx: HealthContext): Insight | null {
  const avg = ctx.day.stressAvg;
  const base = usual(ctx, (d) => d.stressAvg);
  if (avg == null || base == null) return null;
  const numbers = `Estresse médio de ${avg} contra o seu típico de ${int.format(base)} (escala de 0 a 100).`;
  if (avg >= base + 8) {
    return {
      id: "health-stress",
      tone: "attention",
      title: "Estresse acima do seu normal",
      detail: `${numbers} O relógio mede estresse pela variabilidade cardíaca: além de tensão, sono ruim, cafeína, calor e doença também elevam o número.`,
    };
  }
  if (avg <= base - 8) {
    return {
      id: "health-stress",
      tone: "positive",
      title: "Dia mais tranquilo que o normal",
      detail: numbers,
    };
  }
  return null;
}

export function highStressInsight(ctx: HealthContext): Insight | null {
  const share = ctx.day.stressHighShare;
  const base = usual(ctx, (d) => d.stressHighShare);
  if (share == null || base == null) return null;
  if (share < 0.1 || share < 2 * base) return null;
  return {
    id: "health-high-stress",
    tone: "attention",
    title: "Muito tempo em estresse alto",
    detail: `${pct(share)} do dia em estresse alto, contra ${pct(base)} num dia típico seu.`,
  };
}

export function stepsGoalInsight(ctx: HealthContext): Insight | null {
  const { steps, stepGoal } = ctx.day;
  if (steps == null || !stepGoal) return null;
  const share = steps / stepGoal;
  if (share >= 1) {
    return {
      id: "health-steps-goal",
      tone: "positive",
      title: "Meta de passos batida",
      detail: `${int.format(steps)} passos para uma meta de ${int.format(stepGoal)} (${pct(share)}).`,
    };
  }
  if (!isFinished(ctx)) return null;
  return {
    id: "health-steps-goal",
    tone: "info",
    title: "Meta de passos não batida",
    detail: `${int.format(steps)} de ${int.format(stepGoal)} passos (${pct(share)} da meta). A meta da Garmin se ajusta sozinha ao que você vem fazendo.`,
  };
}

export function stepsVsUsualInsight(ctx: HealthContext): Insight | null {
  const steps = ctx.day.steps;
  const base = usual(ctx, (d) => d.steps);
  if (steps == null || base == null || base === 0) return null;
  const ratio = steps / base;
  const numbers = `${int.format(steps)} passos contra a sua mediana de ${int.format(base)}.`;
  if (ratio >= 1.5) {
    return {
      id: "health-steps-usual",
      tone: "positive",
      title: "Dia bem mais ativo que o normal",
      detail: `${numbers} (${pct(ratio)} do habitual)`,
    };
  }
  if (isFinished(ctx) && ratio <= 0.5) {
    return {
      id: "health-steps-usual",
      tone: "info",
      title: "Dia mais parado que o normal",
      detail: `${numbers} (${pct(ratio)} do habitual)`,
    };
  }
  return null;
}

export function stepStreakInsight(ctx: HealthContext): Insight | null {
  const byDate = new Map(ctx.history.map((d) => [d.date, d]));
  byDate.set(ctx.day.date, ctx.day);
  const hit = (d: DayPoint | undefined) =>
    d != null && d.steps != null && d.stepGoal != null && d.steps >= d.stepGoal;
  // A day still in progress does not break the streak; count from the day before.
  let date = !isFinished(ctx) && !hit(ctx.day) ? shiftDate(ctx.day.date, -1) : ctx.day.date;
  let streak = 0;
  while (hit(byDate.get(date))) {
    streak++;
    date = shiftDate(date, -1);
  }
  if (streak < 3) return null;
  return {
    id: "health-steps-streak",
    tone: "positive",
    title: `${streak} dias seguidos batendo a meta de passos`,
    detail: `Sequência atual até ${formatShort(shiftDate(date, streak))}.`,
  };
}

export function intensityWeekInsight(ctx: HealthContext): Insight | null {
  const goal = ctx.day.intensityGoal;
  if (!goal) return null;
  const [y = 0, m = 1, d = 1] = ctx.day.date.split("-").map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() - ctx.weekStartsOn + 7) % 7;
  const weekStart = shiftDate(ctx.day.date, -offset);
  const week = [...ctx.history.filter((p) => p.date >= weekStart), ctx.day];
  const total = week.reduce(
    (sum, p) => sum + (intensityMinutes(p.intensityModerate, p.intensityVigorous) ?? 0),
    0,
  );
  const numbers = `${int.format(total)} de ${int.format(goal)} min de intensidade na semana até aqui (minutos vigorosos contam em dobro).`;
  if (total >= goal) {
    return {
      id: "health-intensity-week",
      tone: "positive",
      title: "Meta semanal de intensidade atingida",
      detail: `${numbers} 150 min por semana é a referência comum da OMS para adultos.`,
    };
  }
  const daysLeft = 6 - offset;
  return {
    id: "health-intensity-week",
    tone: "info",
    title: `Faltam ${int.format(goal - total)} min para a meta semanal de intensidade`,
    detail: `${numbers} ${daysLeft > 0 ? `Restam ${daysLeft} dia${daysLeft > 1 ? "s" : ""} na semana.` : "Último dia da semana."}`,
  };
}

function formatShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

const RULES = [
  restingHrInsight,
  bodyBatteryPeakInsight,
  bodyBatteryBalanceInsight,
  stressInsight,
  highStressInsight,
  stepsGoalInsight,
  stepsVsUsualInsight,
  stepStreakInsight,
  intensityWeekInsight,
];

const TONE_ORDER: Record<InsightTone, number> = { attention: 0, positive: 1, info: 2 };

/** Every observation the day supports, attention first. */
export function generateHealthInsights(ctx: HealthContext): Insight[] {
  if (!ctx.day.hasData) return [];
  return RULES.map((rule) => rule(ctx))
    .filter((i): i is Insight => i != null)
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
