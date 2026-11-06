import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

const summary = () => within(screen.getByRole("group", { name: "Resumo do período" }));

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
    await screen.findByRole("group", { name: "Resumo do período" });
    expect(summary().getByText("15,0 km")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6 meses" })).toHaveAttribute("aria-pressed", "true");
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/runs?from=2025-11-06");
  });

  it("shows period totals with change vs the previous window", async () => {
    mockApi();
    renderPage();
    await screen.findByRole("group", { name: "Resumo do período" });
    const distance = summary().getByText("Distância").closest(".stat-tile")!;
    expect(distance).toHaveTextContent("15,0 km");
    expect(distance).toHaveTextContent("+200%");

    const pace = summary().getByText("Ritmo médio").closest(".stat-tile")!;
    expect(pace).toHaveTextContent("5:00 /km");
    expect(pace).toHaveTextContent("−1:00 /km");
    expect(pace).toHaveTextContent("melhora");

    expect(summary().getByText("Corridas").closest(".stat-tile")).toHaveTextContent("2");
    expect(summary().getByText("Maior corrida").closest(".stat-tile")).toHaveTextContent(
      "10,00 km",
    );
  });

  it("switches period without deltas for 'Tudo'", async () => {
    const fetchMock = mockApi();
    renderPage();
    await screen.findByRole("group", { name: "Resumo do período" });
    expect(summary().getByText("15,0 km")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    expect(await summary().findByText("20,0 km")).toBeInTheDocument();
    // The health × training section fetches too, so look for the call rather than the last one.
    expect(fetchMock.mock.calls.map(([u]) => String(u))).toContain("/api/runs");
    expect(summary().queryByText(/vs /)).not.toBeInTheDocument();
  });

  it("adds a health × training section that asks for the period's health history", async () => {
    const fetchMock = mockApi();
    renderPage();
    expect(await screen.findByRole("heading", { name: "Saúde × treino" })).toBeInTheDocument();
    await vi.waitFor(() => {
      const urls = fetchMock.mock.calls.map(([u]) => String(u));
      expect(urls).toContain("/api/daily/range?from=2026-05-06&to=2026-11-05");
      expect(urls).toContain("/api/sleep?from=2026-05-06&to=2026-11-05");
    });
  });

  it("regroups weeks when the profile's first day of the week arrives after the runs", async () => {
    let releaseProfile = () => {};
    const profileReady = new Promise<void>((r) => (releaseProfile = r));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).startsWith("/api/profile")) {
          await profileReady;
          return Response.json({ firstDayOfWeek: "sunday" });
        }
        return Response.json({ runs: RUNS, days: [], nights: [] });
      }),
    );
    renderPage();
    const weekly = await screen.findByRole("table", { name: "Distância por semana (km)" });
    const firstWeek = () => within(weekly).getAllByRole("row")[1]!;
    expect(within(firstWeek()).getByText("04/05")).toBeInTheDocument(); // Monday default

    releaseProfile();
    // The 6-month window starts Wed 06/05: its week starts Sun 03/05 once the profile is in.
    await vi.waitFor(() => expect(within(firstWeek()).getByText("03/05")).toBeInTheDocument());
  });
});
