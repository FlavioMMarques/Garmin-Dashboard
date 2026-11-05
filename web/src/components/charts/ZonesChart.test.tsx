import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ZonesChart } from "./ZonesChart";

describe("ZonesChart", () => {
  it("states the easy / moderate / hard split", () => {
    render(
      <ZonesChart
        weeks={[{ weekStart: "2026-10-05", zones: [60, 900, 1800, 300, 0], totalS: 3060 }]}
        share={{ easy: 0.25, moderate: 0.51, hard: 0.24 }}
      />,
    );
    expect(
      screen.getByText(/Leve \(Z1–Z2\) 25% · Moderado \(Z3\) 51% · Forte \(Z4–Z5\) 24%/),
    ).toBeInTheDocument();
  });

  it("lists minutes per zone per week in the table", () => {
    render(
      <ZonesChart
        weeks={[{ weekStart: "2026-10-05", zones: [60, 900, 1800, 300, 0], totalS: 3060 }]}
        share={null}
      />,
    );
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("05/101 min15 min30 min5 min0 min51 min");
    expect(screen.getByText(/Sem dados de zona de FC/)).toBeInTheDocument();
  });
});
