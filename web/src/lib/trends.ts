type Value = number | null;

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const present = (values: Value[]) => values.filter((v): v is number => v != null);

/**
 * Trailing mean over `window` days, ignoring days without data; null until the
 * window holds at least `minCount` values.
 */
export function rollingMean(values: Value[], window = 7, minCount = 4): Value[] {
  return values.map((_, i) => {
    const slice = present(values.slice(Math.max(0, i - window + 1), i + 1));
    return slice.length >= minCount ? mean(slice) : null;
  });
}

export interface SeriesSummary {
  /** Days with data. */
  days: number;
  mean: number | null;
  /** Mean of the last 7 days; null with fewer than 4 of them recorded. */
  last7: number | null;
}

export function seriesSummary(values: Value[]): SeriesSummary {
  const all = present(values);
  const recent = present(values.slice(-7));
  return {
    days: all.length,
    mean: all.length ? mean(all) : null,
    last7: recent.length >= 4 ? mean(recent) : null,
  };
}
