import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Night } from "../api/sleep";
import { shiftDate } from "../lib/health";
import { SleepPage } from "./SleepPage";

function night(date: string, over: Partial<Night> = {}): Night {
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
    ...over,
  };
}

/** Nights for any requested range; `make` returns undefined for nights without data. */
function mockApi(make: (date: string) => Night | undefined = (d) => night(d)) {
  const fetchMock = vi.fn(async (url: string) => {
    const { pathname, searchParams } = new URL(url, "http://x");
    if (pathname !== "/api/sleep") return new Response("{}", { status: 200 });
    const nights = [];
    for (let d = searchParams.get("from")!; d <= searchParams.get("to")!; d = shiftDate(d, 1)) {
      nights.push(make(d) ?? { ...night(d), hasData: false, sleepSeconds: null });
    }
    return new Response(JSON.stringify({ nights }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SleepPage />
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

describe("SleepPage", () => {
  it("shows the last 30 nights by default with their averages", async () => {
    const fetchMock = mockApi();
    renderPage();

    await screen.findByText("Sono médio");
    expect(within(tile("Sono médio")).getByText("7 h 00 min")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sleep?from=2026-10-06&to=2026-11-04",
      expect.anything(),
    );
    expect(within(tile("Pontuação média")).getByText("80")).toBeInTheDocument();
    expect(within(tile("VFC noturna média")).getByText("100 ms")).toBeInTheDocument();
    expect(within(tile("Horário médio")).getByText("00:30 → 07:30")).toBeInTheDocument();
  });

  it("draws the phases of each night with a legend", async () => {
    mockApi();
    renderPage();
    await screen.findByText("Sono médio");
    for (const phase of ["Profundo", "Leve", "REM", "Acordado"]) {
      expect(screen.getAllByText(phase).length).toBeGreaterThan(0);
    }
  });

  it("switches period without reloading", async () => {
    const fetchMock = mockApi();
    renderPage();
    await screen.findByText("Sono médio");
    fireEvent.click(screen.getByRole("button", { name: "7 noites" }));
    expect(screen.getByRole("button", { name: "7 noites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sleep?from=2026-10-29&to=2026-11-04",
        expect.anything(),
      ),
    );
  });

  it("explains a period without recorded nights", async () => {
    mockApi(() => undefined);
    renderPage();
    expect(await screen.findByText(/nenhuma noite registrada/i)).toBeInTheDocument();
  });

  it("shows what the nights reveal", async () => {
    mockApi(); // 7 h a night against an 8 h need
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "O que o seu sono mostra" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Dormindo 1 h 00 min a menos/ }),
    ).toBeInTheDocument();
  });
});
