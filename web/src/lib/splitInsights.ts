import type { KmSplit } from "../api/runs";
import type { Insight, InsightTone } from "./insights";

const MIN_KM = 3;
const pct = (n: number) => `${Math.round(Math.abs(n) * 100)}%`;
const pad2 = (n: number) => n.toString().padStart(2, "0");
/** 323 → "5:23 /km". */
export const paceText = (secPerKm: number) =>
  `${Math.floor(secPerKm / 60)}:${pad2(Math.round(secPerKm % 60))} /km`;

const fullKms = (splits: KmSplit[]) => splits.filter((s) => !s.partial);

/** First and second half of the full kilometres; the middle one is left out when odd. */
function halves(splits: KmSplit[]): [KmSplit[], KmSplit[]] | null {
  const full = fullKms(splits);
  if (full.length < MIN_KM) return null;
  const n = Math.floor(full.length / 2);
  return [full.slice(0, n), full.slice(-n)];
}

/** Time-weighted pace of a group of kilometres, in seconds per km. */
const groupPace = (kms: KmSplit[]) =>
  (kms.reduce((a, s) => a + s.durationS, 0) / kms.reduce((a, s) => a + s.distanceM, 0)) * 1000;

export function halvesInsight(splits: KmSplit[]): Insight | null {
  const h = halves(splits);
  if (!h) return null;
  const first = groupPace(h[0]);
  const second = groupPace(h[1]);
  const change = second / first - 1;
  const numbers = `Primeira metade a ${paceText(first)}, segunda a ${paceText(second)}.`;
  if (change <= -0.02) {
    return {
      id: "split-halves",
      tone: "positive",
      title: `Negative split: segunda metade ${Math.round(first - second)} s/km mais rápida`,
      detail: `${numbers} Terminar mais forte do que começou é sinal de ritmo bem dosado.`,
    };
  }
  if (change >= 0.03) {
    return {
      id: "split-halves",
      tone: "info",
      title: `Ritmo caiu ${Math.round(second - first)} s/km na segunda metade`,
      detail: `${numbers} Quando a segunda metade fica bem mais lenta, em geral o começo foi rápido demais para o dia (ou houve calor e subidas no fim).`,
    };
  }
  return null;
}

export function cardiacDriftInsight(splits: KmSplit[]): Insight | null {
  // Heart rate is still climbing during the first kilometre; measure drift after it.
  const h = halves(splits.filter((s) => s.km !== 1));
  if (!h || [...h[0], ...h[1]].some((s) => s.avgHr == null)) return null;
  const hr = (kms: KmSplit[]) =>
    kms.reduce((a, s) => a + s.avgHr! * s.durationS, 0) / kms.reduce((a, s) => a + s.durationS, 0);
  const [hr1, hr2] = [hr(h[0]), hr(h[1])];
  const [p1, p2] = [groupPace(h[0]), groupPace(h[1])];
  // Heartbeats per metre, second half vs first: rises when HR climbs at the same pace.
  const drift = (hr2 * p2) / (hr1 * p1) - 1;
  const numbers = `Do km 2 em diante, a FC média foi de ${Math.round(hr1)} para ${Math.round(hr2)} bpm, com ritmo de ${paceText(p1)} para ${paceText(p2)}.`;
  if (drift >= 0.05) {
    return {
      id: "split-drift",
      tone: "info",
      title: `Deriva cardíaca de ${pct(drift)}`,
      detail: `${numbers} Abaixo de 5% é a referência comum de boa base aeróbica para o ritmo; acima disso, calor, desidratação ou um ritmo forte para o seu condicionamento atual costumam explicar.`,
    };
  }
  if (drift < 0.03) {
    return {
      id: "split-drift",
      tone: "positive",
      title: "FC estável para o ritmo do começo ao fim",
      detail: `${numbers} Deriva cardíaca de ${pct(drift)} (referência comum: abaixo de 5%).`,
    };
  }
  return null;
}

export function steadyPaceInsight(splits: KmSplit[]): Insight | null {
  const paces = fullKms(splits).map((s) => s.paceSecPerKm);
  if (paces.length < 4) return null;
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  const sd = Math.sqrt(paces.reduce((a, p) => a + (p - mean) ** 2, 0) / paces.length);
  if (sd / mean > 0.02) return null;
  return {
    id: "split-steady",
    tone: "positive",
    title: "Ritmo muito constante",
    detail: `Os ${paces.length} km ficaram em média a ${paceText(mean)}, variando só ±${Math.round(sd)} s/km.`,
  };
}

export function cadenceFadeInsight(splits: KmSplit[]): Insight | null {
  const h = halves(splits);
  const full = fullKms(splits);
  const last = full.at(-1);
  if (!h || last?.cadenceSpm == null || h[0].some((s) => s.cadenceSpm == null)) return null;
  const start = h[0].reduce((a, s) => a + s.cadenceSpm!, 0) / h[0].length;
  const drop = start - last.cadenceSpm;
  if (drop < 4) return null;
  return {
    id: "split-cadence",
    tone: "info",
    title: `Cadência caiu ${Math.round(drop)} passos/min no último km`,
    detail: `De ${Math.round(start)} passos/min na primeira metade para ${last.cadenceSpm} no km ${last.km}. Passadas mais longas e lentas no fim costumam ser sinal de fadiga.`,
  };
}

export function fastestSlowestInsight(splits: KmSplit[]): Insight | null {
  const full = fullKms(splits);
  if (full.length < MIN_KM) return null;
  const sorted = [...full].sort((a, b) => a.paceSecPerKm - b.paceSecPerKm);
  const fast = sorted[0]!;
  const slow = sorted.at(-1)!;
  return {
    id: "split-extremes",
    tone: "info",
    title: `Km mais rápido: km ${fast.km}`,
    detail: `O mais rápido foi o km ${fast.km} (${paceText(fast.paceSecPerKm)}) e o mais lento, o km ${slow.km} (${paceText(slow.paceSecPerKm)}): ${slow.paceSecPerKm - fast.paceSecPerKm} s/km de diferença.`,
  };
}

const RULES = [
  halvesInsight,
  cardiacDriftInsight,
  steadyPaceInsight,
  cadenceFadeInsight,
  fastestSlowestInsight,
];
const TONE_ORDER: Record<InsightTone, number> = { attention: 0, positive: 1, info: 2 };

/** Observations about one run's kilometres; needs three full kilometres. */
export function generateSplitInsights(splits: KmSplit[]): Insight[] {
  if (fullKms(splits).length < MIN_KM) return [];
  return RULES.map((rule) => rule(splits))
    .filter((i): i is Insight => i != null)
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
