import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailySummary } from "../api/daily";
import { DailyPage } from "./DailyPage";

const day: DailySummary = {
  date: "2026-11-04",
  hasData: true,
  steps: 5566,
  stepGoal: 9180,
  distanceMeters: 4656,
  floorsAscended: 8.53,
  caloriesTotal: 2371,
  caloriesActive: 56,
  restingHr: 46,
  restingHr7dAvg: 44,
  minHr: 41,
  maxHr: 106,
  stressAvg: 27,
  stressMax: 95,
  stressQualifier: "BALANCED",
  bodyBatteryMin: 15,
  bodyBatteryMax: 70,
  bodyBatteryCharged: 59,
  bodyBatteryDrained: 51,
  bodyBatteryAtWake: 70,
  intensityModerate: 20,
  intensityVigorous: 15,
  intensityGoal: 150,
  spo2Avg: 96,
};

const empty: DailySummary = {
  ...Object.fromEntries(Object.keys(day).map((k) => [k, null])),
  date: "2026-11-03",
  hasData: false,
} as DailySummary;

function mockApi(byDate: Record<string, DailySummary>) {
  const fetchMock = vi.fn(async (url: string) => {
    const date = new URL(url, "http://x").searchParams.get("date")!;
    return new Response(JSON.stringify(byDate[date] ?? { ...empty, date }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DailyPage />
    </QueryClientProvider>,
  );
}

const tile = (label: string) => screen.getByText(label).closest(".stat-tile") as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 4, 9, 0));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("DailyPage", () => {
  it("opens on today and shows the day's metrics", async () => {
    const fetchMock = mockApi({ "2026-11-04": day });
    renderPage();

    await screen.findByText("5.566");
    expect(fetchMock).toHaveBeenCalledWith("/api/daily?date=2026-11-04", expect.anything());
    expect(within(tile("Passos")).getByText(/meta 9\.180/)).toBeInTheDocument();
    expect(within(tile("Calorias")).getByText("2.371 kcal")).toBeInTheDocument();
    expect(within(tile("FC em repouso")).getByText("46 bpm")).toBeInTheDocument();
    expect(within(tile("Estresse médio")).getByText(/Equilibrado/)).toBeInTheDocument();
    expect(within(tile("Body Battery")).getByText("15–70")).toBeInTheDocument();
    expect(within(tile("Minutos de intensidade")).getByText("50 min")).toBeInTheDocument();
    expect(within(tile("Andares subidos")).getByText("8")).toBeInTheDocument(); // whole floors, like Garmin
  });

  it("shows dashes and a note on a day without data", async () => {
    mockApi({});
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /dia anterior/i }));

    expect(await screen.findByText(/sem dados do relógio/i)).toBeInTheDocument();
    expect(within(tile("Passos")).getByText("—")).toBeInTheDocument();
    expect(within(tile("Body Battery")).getByText("—")).toBeInTheDocument();
  });

  it("moves between days and never past today", async () => {
    const fetchMock = mockApi({ "2026-11-04": day });
    renderPage();
    await screen.findByText("5.566");

    const next = screen.getByRole("button", { name: /próximo dia/i });
    expect(next).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /dia anterior/i }));
    await screen.findByText(/sem dados do relógio/i);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/daily?date=2026-11-03", expect.anything());
    expect(screen.getByLabelText("Data")).toHaveValue("2026-11-03");
    expect(next).toBeEnabled();
  });

  it("jumps to a date typed in the date field", async () => {
    const fetchMock = mockApi({ "2026-11-04": day });
    renderPage();
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-10-15" } });
    await screen.findByText(/sem dados do relógio/i);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/daily?date=2026-10-15", expect.anything());
  });
});
