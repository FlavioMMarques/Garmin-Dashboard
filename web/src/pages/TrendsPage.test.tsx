import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayPoint } from "../api/daily";
import type { Night } from "../api/sleep";
import { shiftDate } from "../lib/health";
import { TrendsPage } from "./TrendsPage";

function day(date: string, over: Partial<DayPoint> = {}): DayPoint {
  return {
    date,
    hasData: true,
    steps: 9000,
    stepGoal: 10000,
    restingHr: 45,
    stressAvg: 25,
    stressHighShare: 0.02,
    bodyBatteryMin: 20,
    bodyBatteryMax: 80,
    bodyBatteryCharged: 60,
    bodyBatteryDrained: 60,
    intensityModerate: 0,
    intensityVigorous: 0,
    intensityGoal: 150,
    caloriesActive: 300,
    ...over,
  };
}

function night(date: string): Night {
  return {
    date,
    hasData: true,
    sleepSeconds: 7 * 3600,
    deepSeconds: 3600,
    lightSeconds: 4 * 3600,
    remSeconds: 5400,
    awakeSeconds: 1800,
    napSeconds: 0,
    startLocal: `${date}T00:30`,
    endLocal: `${date}T07:30`,
    score: 80,
    scoreQualifier: "GOOD",
    awakeCount: 1,
    avgSleepStress: 15,
    avgHr: 50,
    avgRespiration: 12,
    avgSpO2: 96,
    sleepNeedMinutes: 480,
    hrvLastNight: 100,
    hrvWeeklyAvg: 100,
    hrvStatus: "BALANCED",
    hrvBalancedLow: 90,
    hrvBalancedUpper: 120,
  };
}

function mockApi(hasData = true) {
  const fetchMock = vi.fn(async (url: string) => {
    const { pathname, searchParams } = new URL(url, "http://x");
    const dates: string[] = [];
    for (let d = searchParams.get("from")!; d <= searchParams.get("to")!; d = shiftDate(d, 1)) {
      dates.push(d);
    }
    if (pathname === "/api/daily/range") {
      const days = dates.map((d) => (hasData ? day(d) : { ...day(d), hasData: false }));
      return new Response(JSON.stringify({ days }), { status: 200 });
    }
    if (pathname === "/api/sleep") {
      const nights = dates.map((d) =>
        hasData ? night(d) : { ...night(d), hasData: false, sleepSeconds: null },
      );
      return new Response(JSON.stringify({ nights }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TrendsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 4, 9, 0));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TrendsPage", () => {
  it("charts each health metric for the last 30 days", async () => {
    const fetchMock = mockApi();
    renderPage();

    expect(await screen.findByRole("heading", { name: /Passos por dia/ })).toBeInTheDocument();
    for (const title of [
      /FC em repouso/,
      /Sono por noite/,
      /VFC noturna/,
      /Estresse médio/,
      /Body Battery/,
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/daily/range?from=2026-10-06&to=2026-11-04",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sleep?from=2026-10-06&to=2026-11-04",
      expect.anything(),
    );
  });

  it("summarizes each metric: period average and last 7 days", async () => {
    mockApi();
    renderPage();
    expect(
      await screen.findByText(/Média do período 45 bpm · últimos 7 dias 45 bpm/),
    ).toBeInTheDocument();
  });

  it("switches period without reloading", async () => {
    const fetchMock = mockApi();
    renderPage();
    await screen.findByRole("heading", { name: /Passos por dia/ });
    fireEvent.click(screen.getByRole("button", { name: "90 dias" }));
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/daily/range?from=2026-08-07&to=2026-11-04",
        expect.anything(),
      ),
    );
  });

  it("explains a period without data", async () => {
    mockApi(false);
    renderPage();
    expect(await screen.findByText(/nenhum dado do relógio/i)).toBeInTheDocument();
  });
});
