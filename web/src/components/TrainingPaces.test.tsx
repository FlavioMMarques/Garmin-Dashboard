import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RunSummary } from "../api/runs";
import { TrainingPaces } from "./TrainingPaces";

const run = (bests: Partial<RunSummary["bestS"]>) =>
  ({
    id: 1,
    startLocal: "2026-10-01 07:00:00",
    bestS: { "1000": null, "1609": null, "5000": null, "10000": null, "21098": null, ...bests },
  }) as RunSummary;

describe("TrainingPaces", () => {
  it("shows Daniels paces and race predictions for the estimated VDOT", () => {
    render(<TrainingPaces runs={[run({ "5000": 20 * 60 })]} />); // VDOT ≈ 49.8
    expect(screen.getByText(/VDOT 49,8 \(estimativa, de 5 km em 20:00\)/)).toBeInTheDocument();
    expect(screen.getByText("Limiar").nextSibling).toHaveTextContent(/4:1\d \/km/);
    expect(screen.getByText("10 km").nextSibling).toHaveTextContent(/41:\d\d/);
  });

  it("explains what is missing without a 5 km+ effort", () => {
    render(<TrainingPaces runs={[run({ "1000": 240 })]} />);
    expect(screen.getByText(/pelo menos um esforço de 5 km/)).toBeInTheDocument();
  });
});
