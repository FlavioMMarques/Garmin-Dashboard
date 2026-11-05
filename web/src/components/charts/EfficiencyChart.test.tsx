import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { efficiencySeries } from "../../lib/performance";
import { EfficiencyChart } from "./EfficiencyChart";

const NO_BESTS = { "1000": null, "1609": null, "5000": null, "10000": null, "21098": null };
const run = (id: number, secPerKm: number, hr: number) => ({
  id,
  startLocal: `2026-10-${String(id).padStart(2, "0")} 07:00:00`,
  distanceM: 5000,
  avgSpeedMps: 1000 / secPerKm,
  avgHr: hr,
  bestS: NO_BESTS,
});

describe("EfficiencyChart", () => {
  it("states the trend from the first to the last rolling median", () => {
    // 200 m/min at 160 bpm = 1.25; 200 m/min at 125 bpm = 1.6
    const points = efficiencySeries([run(1, 300, 160), run(2, 300, 125)], 1);
    render(<EfficiencyChart points={points} window={1} />);
    expect(screen.getByText(/1,25 → 1,60 m \(\+28%\)/)).toBeInTheDocument();
  });

  it("lists pace, heart rate and efficiency per run in the table", () => {
    const points = efficiencySeries([run(1, 300, 160)], 5);
    render(<EfficiencyChart points={points} window={5} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("01/10/2026 07:005,00 km5:00 /km160 bpm1,251,25");
  });
});
