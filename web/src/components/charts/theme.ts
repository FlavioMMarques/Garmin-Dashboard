import { useEffect, useState } from "react";

const TOKENS = {
  series1: "--series-1",
  series2: "--series-2",
  series3: "--series-3",
  muted: "--series-muted",
  grid: "--chart-grid",
  axis: "--chart-axis",
  surface: "--bg-surface",
  /** Tick and label text: a text token, never the axis-line color. */
  text: "--text-muted",
  zone1: "--zone-1",
  zone2: "--zone-2",
  zone3: "--zone-3",
  zone4: "--zone-4",
  zone5: "--zone-5",
} as const;

export type ChartTheme = Record<keyof typeof TOKENS, string>;

function readTheme(): ChartTheme {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(TOKENS).map(([k, v]) => [k, style.getPropertyValue(v).trim() || "currentColor"]),
  ) as ChartTheme;
}

/**
 * SVG presentation attributes can't use CSS variables, so resolve the tokens
 * once and again whenever the OS switches between light and dark.
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => setTheme(readTheme());
    media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, []);
  return theme;
}
