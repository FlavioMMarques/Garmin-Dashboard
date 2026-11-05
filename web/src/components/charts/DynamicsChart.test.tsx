import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RunSummary } from "../../api/runs";
import { DynamicsChart } from "./DynamicsChart";

const run = (id: number, cadenceSpm: number, groundContactMs: number) =>
  ({
    id,
    startLocal: `2026-10-${String(id).padStart(2, "0")} 07:00:00`,
    cadenceSpm,
    groundContactMs,
    verticalOscCm: null,
    verticalRatio: null,
    strideCm: null,
    powerW: null,
  }) as unknown as RunSummary;

describe("DynamicsChart", () => {
  it("shows each metric's trend and which direction is better", () => {
    render(<DynamicsChart runs={[run(1, 160, 280), run(2, 166, 270)]} window={1} />);
    expect(screen.getByRole("heading", { name: /Cadência/ })).toHaveTextContent(
      "Cadência · 160 ppm → 166 ppm · maior é melhor",
    );
    expect(screen.getByRole("heading", { name: /Tempo de contato/ })).toHaveTextContent(
      "280 ms → 270 ms · menor é melhor",
    );
  });

  it("omits metrics the watch did not record", () => {
    render(<DynamicsChart runs={[run(1, 160, 280)]} window={1} />);
    expect(screen.queryByRole("heading", { name: /Potência/ })).not.toBeInTheDocument();
  });
});
