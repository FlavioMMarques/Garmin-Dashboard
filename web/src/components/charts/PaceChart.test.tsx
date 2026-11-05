import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paceSeries } from "../../lib/pace";
import { PaceChart } from "./PaceChart";

const run = (id: number, km: number, secPerKm: number) => ({
  id,
  startLocal: `2026-10-${String(id).padStart(2, "0")} 07:00:00`,
  distanceM: km * 1000,
  avgSpeedMps: 1000 / secPerKm,
});

describe("PaceChart", () => {
  it("summarizes the trend per distance bucket and lists only buckets with runs", () => {
    const points = paceSeries([run(1, 5, 360), run(2, 10, 330), run(3, 5, 300)], 2);
    render(<PaceChart points={points} window={2} />);

    expect(screen.getByText(/Até 8 km 6:00 → 5:30/)).toBeInTheDocument();
    expect(screen.getByText(/8–15 km 5:30 → 5:30/)).toBeInTheDocument();

    const legend = within(screen.getByRole("list"));
    expect(legend.getByText("Até 8 km")).toBeInTheDocument();
    expect(legend.getByText("8–15 km")).toBeInTheDocument();
    expect(legend.queryByText("Mais de 15 km")).not.toBeInTheDocument();
  });

  it("has a table row per run with its pace and the trailing average", () => {
    const points = paceSeries([run(1, 5, 360), run(3, 5, 300)], 2);
    render(<PaceChart points={points} window={2} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[2]).toHaveTextContent("03/10/2026 07:005,00 km5:00 /km5:30 /km");
  });
});
