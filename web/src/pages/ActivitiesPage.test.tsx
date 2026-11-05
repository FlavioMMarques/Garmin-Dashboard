import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActivitiesPage as Page, ActivitySummary } from "../api/activities";
import { ActivitiesPage } from "./ActivitiesPage";

const run: ActivitySummary = {
  id: 1,
  name: "Corrida de teste",
  startLocal: "2026-01-10 07:30:00",
  type: "running",
  distanceM: 6014.28,
  durationS: 2081.125,
  avgSpeedMps: 2.89,
  avgHr: 161,
  calories: 517,
};
const ride: ActivitySummary = {
  ...run,
  id: 2,
  name: "Pedal de teste",
  type: "cycling",
  avgSpeedMps: 8.3333,
};

function mockApi(pages: Record<number, Page>) {
  const fetchMock = vi.fn(async (url: string) => {
    const start = Number(new URL(url, "http://x").searchParams.get("start"));
    return new Response(JSON.stringify(pages[start]), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ActivitiesPage />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ActivitiesPage", () => {
  it("shows pace for runs and km/h for rides", async () => {
    mockApi({ 0: { items: [run, ride], start: 0, limit: 20, hasMore: false } });
    renderPage();

    const runRow = (await screen.findByText("Corrida de teste")).closest("tr")!;
    expect(within(runRow).getByText("5:46 /km")).toBeInTheDocument();
    expect(within(runRow).getByText("6,01 km")).toBeInTheDocument();
    expect(within(runRow).getByText("34:41")).toBeInTheDocument();
    expect(within(runRow).getByText("161 bpm")).toBeInTheDocument();

    const rideRow = screen.getByText("Pedal de teste").closest("tr")!;
    expect(within(rideRow).getByText("30,0 km/h")).toBeInTheDocument();
  });

  it("pages forward and back, 20 per page", async () => {
    const fetchMock = mockApi({
      0: { items: [run], start: 0, limit: 20, hasMore: true },
      20: { items: [ride], start: 20, limit: 20, hasMore: false },
    });
    renderPage();

    await screen.findByText("Corrida de teste");
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/activities?start=0&limit=20");

    fireEvent.click(screen.getByRole("button", { name: /próxima/i }));
    await screen.findByText("Pedal de teste");
    expect(screen.getByText(/Página 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próxima/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    expect(await screen.findByText("Corrida de teste")).toBeInTheDocument();
  });

  it("explains a missing key instead of a blank screen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "missing_key", message: "GARMIN_API_KEY não configurada" },
          { status: 503 },
        ),
      ),
    );
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Chave da Garmin não configurada");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
