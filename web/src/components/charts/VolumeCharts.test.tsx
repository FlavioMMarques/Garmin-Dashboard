import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { yearToDate } from "../../lib/volume";
import { WeeklyVolumeChart, YearToDateChart } from "./VolumeCharts";

describe("WeeklyVolumeChart", () => {
  it("lists every week in the table view, including weeks without runs", () => {
    render(
      <WeeklyVolumeChart
        weeks={[
          { weekStart: "2026-10-05", km: 15, runs: 2, longestKm: 10 },
          { weekStart: "2026-10-12", km: 0, runs: 0, longestKm: 0 },
        ]}
      />,
    );
    const table = screen.getByRole("table", { name: "Distância por semana (km)" });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("05/1015,0 km210,0 km");
    expect(rows[2]).toHaveTextContent("12/100,0 km0—");
    expect(screen.getByText(/Média de 7,5 km por semana/)).toBeInTheDocument();
  });
});

describe("YearToDateChart", () => {
  const run = (startLocal: string, km: number) => ({ startLocal, distanceM: km * 1000 });

  it("compares with last year at the same date and shows both in the legend", () => {
    const ytd = yearToDate(
      [run("2025-01-10 07:00:00", 10), run("2026-01-05 07:00:00", 12)],
      "2026-03-02",
    );
    render(<YearToDateChart ytd={ytd} />);
    expect(
      screen.getByText(/12,0 km em 2026 · 10,0 km até esta data em 2025 \(\+20%\)/),
    ).toBeInTheDocument();
    const legend = screen.getByRole("list");
    expect(within(legend).getByText("2026")).toBeInTheDocument();
    expect(within(legend).getByText("2025")).toBeInTheDocument();
  });

  it("says when there is no previous year to compare with", () => {
    const ytd = yearToDate([run("2026-01-05 07:00:00", 12)], "2026-03-02");
    render(<YearToDateChart ytd={ytd} />);
    expect(screen.getByText(/sem corridas registradas em 2025/)).toBeInTheDocument();
    expect(within(screen.getByRole("list")).queryByText("2025")).not.toBeInTheDocument();
  });
});
