import type { HealthDay } from "../api/wellness";
import { formatTotalTime } from "./format";
import type { Insight } from "./insights";
import { median } from "./pace";

const BASELINE_DAYS = 30;
const MIN_BASELINE_VALUES = 5;
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Median of `pick` over the 30 days before `date` (needs ≥ 5 values). */
export function baseline(
  days: HealthDay[],
  date: string,
  pick: (d: HealthDay) => number | null | undefined,
): number | null {
  const since = shiftDay(date, -BASELINE_DAYS);
  const values = days
    .filter((d) => d.date >= since && d.date < date)
    .map(pick)
    .filter((v): v is number => typeof v === "number");
  return values.length >= MIN_BASELINE_VALUES ? median(values) : null;
}

const BAD_HRV_STATUS = new Set(["UNBALANCED", "LOW", "POOR"]);
const HRV_STATUS_PT: Record<string, string> = {
  BALANCED: "equilibrado",
  UNBALANCED: "desequilibrado",
  LOW: "baixo",
  POOR: "ruim",
};

/** Signals for one day, shared by the single-metric rules and the readiness rule. */
function signals(days: HealthDay[], day: HealthDay) {
  const rhrBase = baseline(days, day.date, (d) => d.restingHr);
  const rhrDiff = day.restingHr != null && rhrBase != null ? day.restingHr - rhrBase : null;
  const night = day.sleep;
  const hours = night?.totalS != null ? night.totalS / 3600 : null;
  const hrvRatio =
    day.hrv?.lastNightAvg && day.hrv.weeklyAvg ? day.hrv.lastNightAvg / day.hrv.weeklyAvg : null;
  const hrvStatusBad = day.hrv?.status != null && BAD_HRV_STATUS.has(day.hrv.status);
  return {
    rhrBase,
    rhrDiff,
    hours,
    rhrHigh: rhrDiff != null && rhrDiff >= 5,
    sleepBad: hours != null && (hours < 6 || (night?.score ?? 100) < 60),
    sleepOk: hours != null && hours >= 7 && (night?.score ?? 70) >= 70,
    hrvBad: (hrvRatio != null && hrvRatio < 0.85) || hrvStatusBad,
    hrvGood: hrvRatio != null && hrvRatio >= 1 && !hrvStatusBad,
    hrvRatio,
    bbBad: day.bodyBatteryMax != null && day.bodyBatteryMax < 50,
    bbGood: day.bodyBatteryMax != null && day.bodyBatteryMax >= 75,
  };
}

/**
 * Observations about one day, compared with the user's previous 30 days. For a day still in
 * progress (today), totals like steps are partial, so they are not judged.
 */
export function dailyInsights(
  days: HealthDay[],
  date: string,
  { inProgress = false }: { inProgress?: boolean } = {},
): Insight[] {
  const day = days.find((d) => d.date === date);
  if (!day) return [];
  const s = signals(days, day);
  const out: Insight[] = [];

  if (s.rhrHigh) {
    out.push({
      id: "rhr",
      tone: "attention",
      title: "FC de repouso acima do normal",
      detail: `Hoje: ${day.restingHr} bpm, contra sua mediana de ${Math.round(s.rhrBase!)} bpm nos últimos 30 dias. Uma alta assim costuma vir com cansaço, estresse, pouco sono ou início de resfriado.`,
    });
  } else if (s.rhrDiff != null && s.rhrDiff <= -3) {
    out.push({
      id: "rhr",
      tone: "positive",
      title: "FC de repouso baixa",
      detail: `Hoje: ${day.restingHr} bpm, abaixo da sua mediana de ${Math.round(s.rhrBase!)} bpm — sinal de boa recuperação.`,
    });
  }

  if (day.sleep && s.hours != null) {
    const dur = formatTotalTime(day.sleep.totalS!);
    const score = day.sleep.score != null ? ` (nota ${day.sleep.score})` : "";
    if (s.hours < 6) {
      out.push({
        id: "sleep",
        tone: "attention",
        title: "Noite curta",
        detail: `Você dormiu ${dur}${score}. Menos de 6 h costuma pesar no humor, na fome e no rendimento do treino.`,
      });
    } else if (s.hours >= 7.5 && (day.sleep.score ?? 0) >= 80) {
      out.push({
        id: "sleep",
        tone: "positive",
        title: "Boa noite de sono",
        detail: `Você dormiu ${dur}${score}.`,
      });
    }
  }

  if (day.hrv?.lastNightAvg != null && day.hrv.weeklyAvg != null) {
    const status = day.hrv.status
      ? ` · status da Garmin: ${HRV_STATUS_PT[day.hrv.status] ?? day.hrv.status.toLowerCase()}`
      : "";
    const numbers = `Noite: ${day.hrv.lastNightAvg} ms, média semanal ${day.hrv.weeklyAvg} ms${status}.`;
    if (s.hrvBad) {
      out.push({
        id: "hrv",
        tone: "attention",
        title: "HRV abaixo da sua média",
        detail: `${numbers} HRV baixa costuma indicar que o corpo ainda está se recuperando.`,
      });
    } else if (s.hrvRatio != null && s.hrvRatio >= 1.1) {
      out.push({ id: "hrv", tone: "positive", title: "HRV acima da sua média", detail: numbers });
    }
  }

  if (s.bbBad) {
    out.push({
      id: "body-battery",
      tone: "attention",
      title: "Pouca energia acumulada",
      detail: `O Body Battery chegou no máximo a ${day.bodyBatteryMax} hoje. Noites curtas, estresse e treinos fortes seguidos drenam a recarga.`,
    });
  } else if (day.bodyBatteryMax != null && day.bodyBatteryMax >= 90) {
    out.push({
      id: "body-battery",
      tone: "positive",
      title: "Energia recarregada",
      detail: `O Body Battery chegou a ${day.bodyBatteryMax}.`,
    });
  }

  if (!inProgress && day.steps != null && day.stepsGoal) {
    if (day.steps >= day.stepsGoal) {
      out.push({
        id: "steps",
        tone: "positive",
        title: "Meta de passos batida",
        detail: `${int.format(day.steps)} passos, meta de ${int.format(day.stepsGoal)}.`,
      });
    } else if (day.steps < day.stepsGoal * 0.5) {
      out.push({
        id: "steps",
        tone: "info",
        title: "Dia com pouco movimento",
        detail: `${int.format(day.steps)} passos, menos da metade da meta de ${int.format(day.stepsGoal)}.`,
      });
    }
  }

  if (day.stressAvg != null && day.stressAvg >= 40) {
    out.push({
      id: "stress",
      tone: "info",
      title: "Dia estressante",
      detail: `Estresse médio de ${day.stressAvg} (escala da Garmin de 0 a 100; acima de 40 é considerado médio/alto).`,
    });
  }

  // Cross-signal: sleep + HRV + Body Battery + resting HR → readiness for a hard session.
  const bad = [
    s.sleepBad && "sono curto ou ruim",
    s.hrvBad && "HRV abaixo da média",
    s.bbBad && "Body Battery baixo",
    s.rhrHigh && "FC de repouso alta",
  ].filter(Boolean) as string[];
  const good = [
    s.sleepOk && "sono bom",
    s.hrvGood && "HRV na média ou acima",
    s.bbGood && "Body Battery alto",
    s.rhrDiff != null && !s.rhrHigh && "FC de repouso normal",
  ].filter(Boolean) as string[];
  if (bad.length >= 2) {
    out.push({
      id: "readiness",
      tone: "attention",
      title: "Pouca recuperação: prefira um treino leve hoje",
      detail: `Sinais combinados: ${bad.join(", ")}. Um dia leve ou de descanso agora rende mais que forçar um treino intenso.`,
    });
  } else if (bad.length === 0 && good.length >= 3) {
    out.push({
      id: "readiness",
      tone: "positive",
      title: "Bem recuperado: bom dia para um treino de qualidade",
      detail: `Sinais combinados: ${good.join(", ")}.`,
    });
  }

  const order = { attention: 0, positive: 1, info: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
