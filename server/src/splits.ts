/** One sample of a recorded run, already in plain units. */
export interface TrackPoint {
  /** Seconds since the start of the recording. */
  t: number;
  distanceM: number | null;
  hr: number | null;
  /** Steps per minute (both feet). */
  cadenceSpm: number | null;
  altitudeM: number | null;
}

export interface KmSplit {
  /** 1-based; the last one may be a partial kilometre. */
  km: number;
  distanceM: number;
  /** Moving time, pauses excluded. */
  durationS: number;
  paceSecPerKm: number;
  avgHr: number | null;
  cadenceSpm: number | null;
  elevationGainM: number | null;
  partial: boolean;
}

const KM = 1000;
/** A gap longer than this between samples is a pause, not running time. */
const PAUSE_GAP_S = 15;
const MIN_PARTIAL_M = 50;
/** Altitude rise needed before it counts as climbing: 2 m had the smallest error (0.66 m/km)
 * against the watch's 1 km laps over 41 km of real runs; 1 m doubles it, 3 m undercounts. */
export const CLIMB_THRESHOLD_M = 2;

interface Acc {
  durationS: number;
  hrSum: number;
  hrWeight: number;
  cadSum: number;
  cadWeight: number;
  gain: number;
  hasAltitude: boolean;
}

const emptyAcc = (): Acc => ({
  durationS: 0,
  hrSum: 0,
  hrWeight: 0,
  cadSum: 0,
  cadWeight: 0,
  gain: 0,
  hasAltitude: false,
});

const round1 = (n: number) => Math.round(n * 10) / 10;

function toSplit(km: number, distanceM: number, a: Acc, partial: boolean): KmSplit {
  return {
    km,
    distanceM: Math.round(distanceM),
    durationS: round1(a.durationS),
    paceSecPerKm: Math.round((a.durationS / distanceM) * KM),
    avgHr: a.hrWeight > 0 ? Math.round(a.hrSum / a.hrWeight) : null,
    cadenceSpm: a.cadWeight > 0 ? Math.round(a.cadSum / a.cadWeight) : null,
    elevationGainM: a.hasAltitude ? Math.round(a.gain) : null,
    partial,
  };
}

/**
 * Kilometre splits from the recorded samples (not from the watch's laps, which
 * depend on its settings). Each kilometre closes where the distance crosses it,
 * with time interpolated between samples; HR and cadence are time-weighted.
 */
export function kmSplits(points: TrackPoint[]): KmSplit[] {
  const track = points
    .filter((p): p is TrackPoint & { distanceM: number } => p.distanceM != null)
    .sort((a, b) => a.t - b.t);
  const splits: KmSplit[] = [];
  let acc = emptyAcc();
  // Hysteresis: a climb counts once altitude is CLIMB_THRESHOLD_M above the lowest
  // point since the last counted climb, so barometric jitter adds nothing.
  let anchor = track.find((p) => p.altitudeM != null)?.altitudeM ?? null;

  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!;
    const b = track[i]!;
    const dt = b.t - a.t;
    if (dt <= 0) continue;
    const moving = dt <= PAUSE_GAP_S;
    const dd = Math.max(0, b.distanceM - a.distanceM);
    let climb: number | null = null;
    if (b.altitudeM != null && anchor != null) {
      climb = 0;
      if (b.altitudeM - anchor >= CLIMB_THRESHOLD_M) {
        climb = b.altitudeM - anchor;
        anchor = b.altitudeM;
      } else if (b.altitudeM < anchor) {
        anchor = b.altitudeM;
      }
    }

    /** Adds the share of this sample pair that falls in the current kilometre. */
    const add = (share: number) => {
      const time = moving ? dt * share : 0;
      acc.durationS += time;
      if (b.hr != null && time > 0) {
        acc.hrSum += b.hr * time;
        acc.hrWeight += time;
      }
      if (b.cadenceSpm != null && time > 0) {
        acc.cadSum += b.cadenceSpm * time;
        acc.cadWeight += time;
      }
      if (climb != null) {
        acc.gain += climb * share;
        acc.hasAltitude = true;
      }
    };

    let from = a.distanceM;
    // Close every kilometre this pair crosses.
    for (let edge = (splits.length + 1) * KM; dd > 0 && edge <= b.distanceM; edge += KM) {
      add((edge - from) / dd);
      splits.push(toSplit(splits.length + 1, KM, acc, false));
      acc = emptyAcc();
      from = edge;
    }
    add(dd > 0 ? (b.distanceM - from) / dd : 1);
  }

  const last = track.at(-1);
  const rest = last ? last.distanceM - splits.length * KM : 0;
  if (rest >= MIN_PARTIAL_M) splits.push(toSplit(splits.length + 1, rest, acc, true));
  return splits;
}
