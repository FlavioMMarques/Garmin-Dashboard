import type { Night } from "../api/sleep";
import { formatTotalTime } from "./format";
import type { Insight, InsightTone } from "./insights";
import { median } from "./pace";
import { clockFromNoon, formatClock, minutesFromNoon } from "./sleep";

export interface SleepContext {
  /** Every night of the selected period, oldest first (nights without data included). */
  nights: Night[];
}

const H = 3600;
const pct = (share: number) => `${Math.round(share * 100)}%`;
const duration = (seconds: number) => formatTotalTime(Math.abs(seconds));
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const recorded = (nights: Night[]) => nights.filter((n) => n.hasData);

function values(nights: Night[], pick: (n: Night) => number | null): number[] {
  return recorded(nights)
    .map(pick)
    .filter((v): v is number => v != null);
}

function bedtimes(nights: Night[]): number[] {
  return recorded(nights)
    .map((n) => n.startLocal)
    .filter((v): v is string => v != null)
    .map(minutesFromNoon);
}

/** Wake-up date on Saturday or Sunday: the Friday and Saturday nights. */
const isWeekendNight = (n: Night) => [0, 6].includes(new Date(`${n.date}T12:00Z`).getUTCDay());

export function sleepNeedInsight({ nights }: SleepContext): Insight | null {
  const both = recorded(nights).filter((n) => n.sleepSeconds != null && n.sleepNeedMinutes != null);
  if (both.length < 5) return null;
  const slept = mean(both.map((n) => n.sleepSeconds!));
  const need = mean(both.map((n) => n.sleepNeedMinutes! * 60));
  const gap = need - slept;
  const numbers = `Média de ${duration(slept)} por noite contra uma necessidade média de ${duration(need)} estimada pela Garmin (${both.length} noites).`;
  if (gap >= 45 * 60) {
    return {
      id: "sleep-need",
      tone: "attention",
      title: `Dormindo ${duration(gap)} a menos do que precisa`,
      detail: `${numbers} A necessidade sobe depois de treinos fortes, estresse e noites ruins; a referência comum para adultos é de 7 a 9 h.`,
    };
  }
  if (gap <= 10 * 60) {
    return {
      id: "sleep-need",
      tone: "positive",
      title: "Sono cobrindo a sua necessidade",
      detail: numbers,
    };
  }
  return {
    id: "sleep-need",
    tone: "info",
    title: `Sono perto da necessidade (faltam ${duration(gap)})`,
    detail: numbers,
  };
}

export function shortNightsInsight({ nights }: SleepContext): Insight | null {
  const sleeps = values(nights, (n) => n.sleepSeconds);
  if (sleeps.length < 5) return null;
  const short = sleeps.filter((s) => s < 6 * H).length;
  if (short / sleeps.length < 0.3) return null;
  return {
    id: "sleep-short",
    tone: "attention",
    title: `${short} de ${sleeps.length} noites com menos de 6 h`,
    detail: `${pct(short / sleeps.length)} das noites registradas ficaram abaixo de 6 h. Noites curtas seguidas acumulam e costumam aparecer na FC de repouso, na VFC e no desempenho dos treinos.`,
  };
}

export function bedtimeRegularityInsight({ nights }: SleepContext): Insight | null {
  const times = bedtimes(nights);
  if (times.length < 7) return null;
  // Median and median absolute deviation: one daytime sleep or late party night
  // should not define how regular the bedtime is.
  const typical = median(times);
  const spread = median(times.map((t) => Math.abs(t - typical)));
  const off = times.filter((t) => Math.abs(t - typical) > 60).length;
  const numbers = `Você costuma dormir por volta das ${formatClock(clockFromNoon(typical))}, com variação típica de ±${Math.round(spread)} min; ${plural(off, "noite ficou", "noites ficaram")} a mais de 1 h desse horário (${times.length} noites).`;
  if (spread >= 45) {
    return {
      id: "sleep-regularity",
      tone: "attention",
      title: "Horário de dormir muito irregular",
      detail: `${numbers} Horários estáveis ajudam o relógio biológico; horários muito variáveis são comuns em quem dorme pior.`,
    };
  }
  if (spread <= 20) {
    return {
      id: "sleep-regularity",
      tone: "positive",
      title: "Horário de dormir regular",
      detail: numbers,
    };
  }
  return null;
}

export function weekendShiftInsight({ nights }: SleepContext): Insight | null {
  const withTime = recorded(nights).filter((n) => n.startLocal != null);
  const weekend = withTime.filter(isWeekendNight).map((n) => minutesFromNoon(n.startLocal!));
  const week = withTime
    .filter((n) => !isWeekendNight(n))
    .map((n) => minutesFromNoon(n.startLocal!));
  if (weekend.length < 2 || week.length < 4) return null;
  const shift = mean(weekend) - mean(week);
  if (shift < 60) return null;
  return {
    id: "sleep-weekend",
    tone: "info",
    title: "Fim de semana com horário bem mais tarde",
    detail: `Nas noites de sexta e sábado você dorme em média ${duration(shift * 60)} mais tarde (${formatClock(clockFromNoon(mean(weekend)))} contra ${formatClock(clockFromNoon(mean(week)))} nos outros dias). Essa mudança, o "jet lag social", costuma deixar a segunda-feira mais pesada.`,
  };
}

export function phasesInsight({ nights }: SleepContext): Insight | null {
  const staged = recorded(nights).filter(
    (n) => n.deepSeconds != null && n.lightSeconds != null && n.remSeconds != null,
  );
  if (staged.length < 5) return null;
  const sum = (pick: (n: Night) => number) => staged.reduce((a, n) => a + pick(n), 0);
  const asleep = sum((n) => n.deepSeconds! + n.lightSeconds! + n.remSeconds!);
  if (asleep === 0) return null;
  const deep = sum((n) => n.deepSeconds!) / asleep;
  const rem = sum((n) => n.remSeconds!) / asleep;
  const numbers = `Profundo ${pct(deep)} e REM ${pct(rem)} do tempo dormindo (referência comum: profundo ~13–23%, REM ~20–25%).`;
  const low = [deep < 0.13 && "sono profundo", rem < 0.18 && "REM"].filter(Boolean);
  if (low.length > 0) {
    return {
      id: "sleep-phases",
      tone: "info",
      title: `Pouco ${low.join(" e ")} em relação à referência`,
      detail: `${numbers} O REM se concentra no fim da noite, então noites encurtadas cortam principalmente o REM; álcool perto de dormir também reduz as duas fases. A estimativa de fases pelo relógio é aproximada.`,
    };
  }
  return {
    id: "sleep-phases",
    tone: "positive",
    title: "Fases do sono dentro da referência",
    detail: numbers,
  };
}

export function hrvInsight({ nights }: SleepContext): Insight | null {
  const recent = nights.slice(-7);
  const hrv = values(recent, (n) => n.hrvLastNight);
  if (hrv.length < 5) return null;
  const ranged = [...nights]
    .reverse()
    .find((n) => n.hrvBalancedLow != null && n.hrvBalancedUpper != null);
  if (!ranged) return null;
  const avg = Math.round(mean(hrv));
  const range = `${ranged.hrvBalancedLow}–${ranged.hrvBalancedUpper} ms`;
  const numbers = `VFC noturna média de ${avg} ms nas últimas ${hrv.length} noites; a sua faixa equilibrada é ${range}.`;
  if (avg < ranged.hrvBalancedLow!) {
    return {
      id: "sleep-hrv",
      tone: "attention",
      title: "VFC abaixo da sua faixa equilibrada",
      detail: `${numbers} VFC baixa por vários dias costuma refletir carga de treino alta, estresse, sono ruim, álcool ou doença.`,
    };
  }
  if (avg > ranged.hrvBalancedUpper!) {
    return {
      id: "sleep-hrv",
      tone: "info",
      title: "VFC acima da sua faixa equilibrada",
      detail: `${numbers} Em geral é sinal de boa recuperação, mas picos isolados também acontecem depois de dias de descanso total.`,
    };
  }
  return {
    id: "sleep-hrv",
    tone: "positive",
    title: "VFC dentro da sua faixa equilibrada",
    detail: numbers,
  };
}

export function recentTrendInsight({ nights }: SleepContext): Insight | null {
  if (nights.length < 15) return null;
  const last = values(nights.slice(-7), (n) => n.sleepSeconds);
  const before = values(nights.slice(0, -7), (n) => n.sleepSeconds);
  if (last.length < 4 || before.length < 7) return null;
  const diff = mean(last) - mean(before);
  const numbers = `${duration(mean(last))} por noite na última semana contra ${duration(mean(before))} antes, no mesmo período.`;
  if (diff <= -30 * 60) {
    return {
      id: "sleep-trend",
      tone: "attention",
      title: `Última semana com ${duration(diff)} a menos de sono por noite`,
      detail: numbers,
    };
  }
  if (diff >= 30 * 60) {
    return {
      id: "sleep-trend",
      tone: "positive",
      title: `Última semana com ${duration(diff)} a mais de sono por noite`,
      detail: numbers,
    };
  }
  return null;
}

export function bedtimeScoreInsight({ nights }: SleepContext): Insight | null {
  const scored = recorded(nights)
    .filter((n) => n.startLocal != null && n.score != null)
    .map((n) => ({ bed: minutesFromNoon(n.startLocal!), score: n.score! }));
  if (scored.length < 10) return null;
  const cut = median(scored.map((s) => s.bed));
  const early = scored.filter((s) => s.bed <= cut).map((s) => s.score);
  const late = scored.filter((s) => s.bed > cut).map((s) => s.score);
  if (early.length < 4 || late.length < 4) return null;
  const e = Math.round(mean(early));
  const l = Math.round(mean(late));
  if (Math.abs(e - l) < 5) return null;
  const clock = formatClock(clockFromNoon(cut));
  return {
    id: "sleep-bedtime-score",
    tone: "info",
    title:
      e > l
        ? `Suas melhores noites começam antes das ${clock}`
        : `Dormir mais tarde não piorou a sua pontuação`,
    detail: `Pontuação média de ${e} nas ${plural(early.length, "noite", "noites")} em que você dormiu até ${clock}, contra ${l} quando dormiu depois.`,
  };
}

export function missingNightsInsight({ nights }: SleepContext): Insight | null {
  if (nights.length < 7) return null;
  const missing = nights.filter((n) => !n.hasData).length;
  if (missing / nights.length < 0.2) return null;
  return {
    id: "sleep-missing",
    tone: "info",
    title: `${missing} de ${nights.length} noites sem registro`,
    detail:
      "Sem o relógio no pulso à noite, as médias e observações deste período ficam menos precisas.",
  };
}

const RULES = [
  sleepNeedInsight,
  shortNightsInsight,
  recentTrendInsight,
  hrvInsight,
  bedtimeRegularityInsight,
  weekendShiftInsight,
  phasesInsight,
  bedtimeScoreInsight,
  missingNightsInsight,
];

const TONE_ORDER: Record<InsightTone, number> = { attention: 0, positive: 1, info: 2 };

/** Every observation the selected nights support, attention first. */
export function generateSleepInsights(ctx: SleepContext): Insight[] {
  if (recorded(ctx.nights).length === 0) return [];
  return RULES.map((rule) => rule(ctx))
    .filter((i): i is Insight => i != null)
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
