import type { DayPoint } from "../api/daily";
import type { RunSummary } from "../api/runs";
import type { Night } from "../api/sleep";
import { formatDecimal } from "./format";
import { shiftDate } from "./health";
import type { Insight } from "./insights";
import { median } from "./pace";

export interface CrossContext {
  /** Runs of the selected period, oldest first. */
  runs: RunSummary[];
  /** One point per day covering the runs (days without data included). */
  days: DayPoint[];
  /** One night per day covering the runs; a night is stored under the day you woke up. */
  nights: Night[];
}

const H = 3600;
const MIN_GROUP = 4;
const CAVEAT = "É uma correlação nos seus dados, não prova de causa.";
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const runDate = (r: RunSummary) => r.startLocal.slice(0, 10);
const runHour = (r: RunSummary) => Number(r.startLocal.slice(11, 13));

/** Meters covered per heartbeat: faster at the same HR, or the same pace at a lower HR. */
function efficiency(r: RunSummary): number | null {
  return r.avgSpeedMps && r.avgHr ? (r.avgSpeedMps * 60) / r.avgHr : null;
}

function lookups({ days, nights }: CrossContext) {
  const dayBy = new Map(days.filter((d) => d.hasData).map((d) => [d.date, d]));
  const nightBy = new Map(nights.filter((n) => n.hasData).map((n) => [n.date, n]));
  return {
    day: (date: string) => dayBy.get(date),
    /** The night before a run's day (Garmin dates a night by the morning you woke up). */
    nightBefore: (r: RunSummary) => nightBy.get(runDate(r)),
    nightAfter: (r: RunSummary) => nightBy.get(shiftDate(runDate(r), 1)),
  };
}

interface Group {
  runs: RunSummary[];
  /** Completes "depois de …" / "em dias com …", e.g. "noites de 7 h ou mais". */
  label: string;
}

/**
 * Median efficiency of runs under a favorable condition vs an unfavorable one.
 * Null with fewer than MIN_GROUP runs per group or under a 3% gap.
 */
function efficiencyGap(
  id: string,
  good: Group,
  bad: Group,
  titles: { goodWins: string; noGain: string },
  connector: string,
): Insight | null {
  const effs = (g: Group) => g.runs.map(efficiency).filter((v): v is number => v != null);
  const g = effs(good);
  const b = effs(bad);
  if (g.length < MIN_GROUP || b.length < MIN_GROUP) return null;
  const mg = median(g);
  const mb = median(b);
  const gap = mg / mb - 1;
  if (Math.abs(gap) < 0.03) return null;
  return {
    id,
    tone: "info",
    title: gap > 0 ? titles.goodWins : titles.noGain,
    detail: `Eficiência mediana de ${formatDecimal(mg)} m por batimento ${connector} ${good.label} (${g.length} corridas) contra ${formatDecimal(mb)} ${connector} ${bad.label} (${b.length}), ${int.format(Math.abs(gap) * 100)}% de diferença. ${CAVEAT}`,
  };
}

export function sleepBeforeRunInsight(ctx: CrossContext): Insight | null {
  const { nightBefore } = lookups(ctx);
  const slept = (r: RunSummary) => nightBefore(r)?.sleepSeconds ?? null;
  return efficiencyGap(
    "cross-sleep-run",
    { runs: ctx.runs.filter((r) => (slept(r) ?? 0) >= 7 * H), label: "noites de 7 h ou mais" },
    {
      runs: ctx.runs.filter((r) => slept(r) != null && slept(r)! < 6 * H),
      label: "noites com menos de 6 h",
    },
    {
      goodWins: "Você corre melhor depois de noites de 7 h ou mais",
      noGain: "Noites de 7 h ou mais não melhoraram as suas corridas",
    },
    "depois de",
  );
}

export function hrvBeforeRunInsight(ctx: CrossContext): Insight | null {
  const { nightBefore } = lookups(ctx);
  const status = (r: RunSummary) => {
    const n = nightBefore(r);
    if (n?.hrvLastNight == null || n.hrvBalancedLow == null || n.hrvBalancedUpper == null) {
      return null;
    }
    if (n.hrvLastNight < n.hrvBalancedLow) return "low";
    return n.hrvLastNight <= n.hrvBalancedUpper ? "balanced" : "high";
  };
  return efficiencyGap(
    "cross-hrv-run",
    {
      runs: ctx.runs.filter((r) => status(r) === "balanced"),
      label: "noites com VFC na sua faixa equilibrada",
    },
    { runs: ctx.runs.filter((r) => status(r) === "low"), label: "noites com VFC abaixo da faixa" },
    {
      goodWins: "Com VFC equilibrada na véspera, as corridas rendem mais",
      noGain: "VFC baixa na véspera não pesou nas suas corridas",
    },
    "depois de",
  );
}

export function bodyBatteryRunInsight(ctx: CrossContext): Insight | null {
  const { day } = lookups(ctx);
  const peak = (r: RunSummary) => day(runDate(r))?.bodyBatteryMax ?? null;
  return efficiencyGap(
    "cross-bb-run",
    { runs: ctx.runs.filter((r) => (peak(r) ?? 0) >= 85), label: "Body Battery de 85 ou mais" },
    {
      runs: ctx.runs.filter((r) => peak(r) != null && peak(r)! < 70),
      label: "Body Battery abaixo de 70",
    },
    {
      goodWins: "Dias de Body Battery alto rendem corridas melhores",
      noGain: "Body Battery baixo não pesou nas suas corridas",
    },
    "em dias com pico de",
  );
}

export function restingHrRunInsight(ctx: CrossContext): Insight | null {
  const { day } = lookups(ctx);
  const values = ctx.days.filter((d) => d.hasData && d.restingHr != null).map((d) => d.restingHr!);
  if (values.length < 14) return null;
  const base = median(values);
  const hr = (r: RunSummary) => day(runDate(r))?.restingHr ?? null;
  return efficiencyGap(
    "cross-resting-hr-run",
    {
      runs: ctx.runs.filter((r) => hr(r) != null && hr(r)! <= base + 1),
      label: `FC em repouso normal, até ${int.format(base + 1)} bpm`,
    },
    {
      runs: ctx.runs.filter((r) => hr(r) != null && hr(r)! >= base + 3),
      label: `FC em repouso elevada, de ${int.format(base + 3)} bpm ou mais`,
    },
    {
      goodWins: "FC em repouso elevada pesa nas suas corridas",
      noGain: "FC em repouso elevada não pesou nas suas corridas",
    },
    "em dias com",
  );
}

const isHard = (r: RunSummary) => (r.aerobicTe ?? 0) >= 3.5 || (r.anaerobicTe ?? 0) >= 2;
const isEasy = (r: RunSummary) => r.aerobicTe != null && r.aerobicTe < 3 && !isHard(r);

export function hardRunNextNightInsight(ctx: CrossContext): Insight | null {
  const { nightAfter } = lookups(ctx);
  const after = (runs: RunSummary[]) => runs.map(nightAfter).filter((n): n is Night => n != null);
  const hard = after(ctx.runs.filter(isHard));
  const easy = after(ctx.runs.filter(isEasy));
  if (hard.length < MIN_GROUP || easy.length < MIN_GROUP) return null;
  const avg = (ns: Night[], pick: (n: Night) => number | null) => {
    const v = ns.map(pick).filter((x): x is number => x != null);
    return v.length >= MIN_GROUP ? mean(v) : null;
  };
  const hrvHard = avg(hard, (n) => n.hrvLastNight);
  const hrvEasy = avg(easy, (n) => n.hrvLastNight);
  const scoreHard = avg(hard, (n) => n.score);
  const scoreEasy = avg(easy, (n) => n.score);
  const hrvDrop = hrvHard != null && hrvEasy != null ? 1 - hrvHard / hrvEasy : 0;
  const scoreDrop = scoreHard != null && scoreEasy != null ? scoreEasy - scoreHard : 0;
  if (hrvDrop < 0.05 && scoreDrop < 4) return null;
  const parts = [
    hrvDrop >= 0.05 && `VFC média de ${int.format(hrvHard!)} ms contra ${int.format(hrvEasy!)} ms`,
    scoreDrop >= 4 &&
      `pontuação do sono de ${int.format(scoreHard!)} contra ${int.format(scoreEasy!)}`,
  ].filter(Boolean);
  return {
    id: "cross-hard-night",
    tone: "info",
    title: "Treinos fortes aparecem na noite seguinte",
    detail: `Na noite depois de treinos fortes (${hard.length}): ${parts.join("; ")} depois de treinos leves (${easy.length}). É o custo esperado de um treino puxado; vale prestar atenção quando dois treinos fortes ficam muito próximos.`,
  };
}

export function lateRunSleepInsight(ctx: CrossContext): Insight | null {
  const { nightAfter } = lookups(ctx);
  const nightsOf = (runs: RunSummary[]) =>
    runs.map(nightAfter).filter((n): n is Night => n != null);
  const late = nightsOf(ctx.runs.filter((r) => runHour(r) >= 19));
  const other = nightsOf(ctx.runs.filter((r) => runHour(r) < 19));
  if (late.length < 3 || other.length < MIN_GROUP) return null;
  const avg = (ns: Night[], pick: (n: Night) => number | null) => {
    const v = ns.map(pick).filter((x): x is number => x != null);
    return v.length ? mean(v) : null;
  };
  const sLate = avg(late, (n) => n.score);
  const sOther = avg(other, (n) => n.score);
  if (sLate == null || sOther == null || Math.abs(sOther - sLate) < 4) return null;
  return {
    id: "cross-late-run",
    tone: "info",
    title:
      sLate < sOther
        ? "Correr à noite piora o seu sono"
        : "Correr à noite não atrapalhou o seu sono",
    detail: `Pontuação média de ${int.format(sLate)} nas noites depois de corridas a partir das 19h (${late.length}) contra ${int.format(sOther)} depois de corridas mais cedo (${other.length}). ${CAVEAT}`,
  };
}

const RULES = [
  sleepBeforeRunInsight,
  hrvBeforeRunInsight,
  bodyBatteryRunInsight,
  restingHrRunInsight,
  hardRunNextNightInsight,
  lateRunSleepInsight,
];

/** Every health × training observation the period supports. */
export function generateCrossInsights(ctx: CrossContext): Insight[] {
  if (ctx.runs.length === 0) return [];
  return RULES.map((rule) => rule(ctx)).filter((i): i is Insight => i != null);
}
