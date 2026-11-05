import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RunSummary } from "../../api/runs";
import { HeatChart } from "./HeatChart";
import { TrainingTypesChart } from "./TrainingTypesChart";

describe("TrainingTypesChart", () => {
  it("lists each training type with its count and share", () => {
    render(
      <TrainingTypesChart
        counts={[
          { label: "TEMPO", name: "Tempo", count: 3 },
          { label: "AEROBIC_BASE", name: "Base aeróbica", count: 1 },
        ]}
      />,
    );
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Tempo375%");
    expect(rows[2]).toHaveTextContent("Base aeróbica125%");
  });
});

describe("HeatChart", () => {
  const run = (id: number, tempC: number, secPerKm: number) =>
    ({
      id,
      startLocal: `2026-10-${String(id).padStart(2, "0")} 07:00:00`,
      distanceM: 5000,
      avgSpeedMps: 1000 / secPerKm,
      tempC,
    }) as RunSummary;

  it("compares the median pace of the coolest and hottest bands", () => {
    render(<HeatChart runs={[run(1, 22.5, 330), run(2, 23, 340), run(3, 29, 360)]} />);
    expect(screen.getByText(/22–24 °C: 5:35 \/km · a 28–30 °C: 6:00 \/km/)).toBeInTheDocument();
  });

  it("says when temperatures don't vary enough", () => {
    render(<HeatChart runs={[run(1, 22.5, 330)]} />);
    expect(screen.getByText(/Pouca variação de temperatura/)).toBeInTheDocument();
  });
});
