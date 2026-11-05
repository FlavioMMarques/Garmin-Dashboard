import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BestDistance, RunSummary } from "../api/runs";
import { BestEffortTiles } from "./BestEffortTiles";

function run(
  id: number,
  startLocal: string,
  bests: Partial<Record<BestDistance, number>>,
): RunSummary {
  return {
    id,
    startLocal,
    type: "running",
    distanceM: 10000,
    durationS: 3000,
    movingS: 3000,
    avgSpeedMps: 3.33,
    avgHr: 150,
    maxHr: null,
    cadenceSpm: null,
    strideCm: null,
    verticalOscCm: null,
    groundContactMs: null,
    verticalRatio: null,
    powerW: null,
    elevationGainM: null,
    tempC: null,
    aerobicTe: null,
    anaerobicTe: null,
    trainingLabel: null,
    bestS: { "1000": null, "1609": null, "5000": null, "10000": null, "21098": null, ...bests },
    hrZonesS: null,
  };
}

const tiles = () => within(screen.getByRole("group", { name: "Melhores marcas do período" }));

describe("BestEffortTiles", () => {
  it("shows the period best with pace, date and change vs the previous window", () => {
    render(
      <BestEffortTiles
        current={[run(2, "2026-10-12 07:00:00", { "5000": 1563 })]}
        previous={[run(1, "2026-03-01 07:00:00", { "5000": 1605 })]}
        deltaLabel="vs 6 meses anteriores"
      />,
    );
    const fiveK = tiles().getByText("5 km").closest(".stat-tile")!;
    expect(fiveK).toHaveTextContent("26:03");
    expect(fiveK).toHaveTextContent("5:13 /km · 12/10");
    expect(fiveK).toHaveTextContent("−0:42");
    expect(fiveK).toHaveTextContent("melhora");
    expect(tiles().queryByText("10 km")).not.toBeInTheDocument();
  });

  it("labels VDOT as an estimate and names the effort it came from", () => {
    render(
      <BestEffortTiles
        current={[run(1, "2026-10-12 07:00:00", { "10000": 3192 })]}
        previous={[]}
        deltaLabel=""
      />,
    );
    const vdot = tiles().getByText("VDOT (estimativa)").closest(".stat-tile")!;
    expect(vdot).toHaveTextContent("de 10 km em 53:12");
    expect(vdot).not.toHaveTextContent("vs");
  });
});
