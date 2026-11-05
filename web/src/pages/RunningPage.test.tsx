import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunSummary } from "../api/runs";
import { RunningPage } from "./RunningPage";

const TODAY = new Date(2026, 10, 5);

function run(id: number, startLocal: string, distanceM: number, movingS: number): RunSummary {
  return {
    id,
    startLocal,
    type: "running",
    distanceM,
    durationS: movingS,
    movingS,
    avgSpeedMps: distanceM / movingS,
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
    bestS: { "1000": null, "1609": null, "5000": null, "10000": null, "21098": null },
    hrZonesS: null,
  };
}

// previous 6-month window: one 5 km run at 6:00/km; current: 10 km + 5 km at 5:00/km
const RUNS = [
  run(1, "2026-01-10 07:00:00", 5000, 1800),
  run(2, "2026-09-01 07:00:00", 10000, 3000),
  run(3, "2026-10-01 07:00:00", 5000, 1500),
];

function mockApi() {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
    Response.json({ runs: RUNS }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RunningPage today={TODAY} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("RunningPage", () => {
  it("defaults to 6 months and fetches from the start of the previous window", async () => {
    const fetchMock = mockApi();
    renderPage();
    await screen.findByText("15,0 km");
    expect(screen.getByRole("button", { name: "6 meses" })).toHaveAttribute("aria-pressed", "true");
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/runs?from=2025-11-06");
  });

  it("shows period totals with change vs the previous window", async () => {
    mockApi();
    renderPage();
    const distance = (await screen.findByText("Distância")).closest(".stat-tile")!;
    expect(distance).toHaveTextContent("15,0 km");
    expect(distance).toHaveTextContent("+200%");

    const pace = screen.getByText("Ritmo médio").closest(".stat-tile")!;
    expect(pace).toHaveTextContent("5:00 /km");
    expect(pace).toHaveTextContent("−1:00 /km");
    expect(pace).toHaveTextContent("melhora");

    expect(screen.getByText("Corridas").closest(".stat-tile")).toHaveTextContent("2");
    expect(screen.getByText("Maior corrida").closest(".stat-tile")).toHaveTextContent("10,00 km");
  });

  it("switches period without deltas for 'Tudo'", async () => {
    const fetchMock = mockApi();
    renderPage();
    await screen.findByText("15,0 km");
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    expect(await screen.findByText("20,0 km")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.at(-1)![0])).toBe("/api/runs");
    expect(screen.queryByText(/vs /)).not.toBeInTheDocument();
  });
});
