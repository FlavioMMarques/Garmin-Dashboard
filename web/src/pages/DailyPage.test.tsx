import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { daySeries, mkNight } from "../test/health";
import { DailyPage } from "./DailyPage";

const TODAY = new Date(2026, 10, 5);

function mockApi(days = daySeries(31, "2026-11-05")) {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => Response.json({ days }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DailyPage today={TODAY} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("DailyPage", () => {
  it("loads the day with the 30 days before it for comparison", async () => {
    const fetchMock = mockApi();
    renderPage();
    await screen.findByRole("group", { name: "Números do dia" });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/wellness?from=2026-10-06&to=2026-11-05");
  });

  it("shows the day's numbers and its insights", async () => {
    mockApi(
      daySeries(31, "2026-11-05", (i) =>
        i === 30 ? { restingHr: 52, sleep: mkNight({ totalS: 5 * 3600, score: 60 }) } : {},
      ),
    );
    renderPage();
    const tiles = within(await screen.findByRole("group", { name: "Números do dia" }));
    expect(tiles.getByText("FC de repouso").closest(".stat-tile")).toHaveTextContent("52 bpm");
    expect(tiles.getByText("Sono").closest(".stat-tile")).toHaveTextContent("5 h 00 min");
    expect(screen.getByText("FC de repouso acima do normal")).toBeInTheDocument();
    expect(screen.getByText("Noite curta")).toBeInTheDocument();
  });

  it("moves to the previous day and cannot go past today", async () => {
    const fetchMock = mockApi();
    renderPage();
    await screen.findByRole("group", { name: "Números do dia" });
    expect(screen.getByRole("button", { name: /Próximo dia/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Dia anterior/ }));
    expect(screen.getByLabelText("Escolher dia")).toHaveValue("2026-11-04");
    await vi.waitFor(() =>
      expect(String(fetchMock.mock.calls.at(-1)![0])).toBe(
        "/api/wellness?from=2026-10-05&to=2026-11-04",
      ),
    );
  });

  it("says when the watch has no data for the day", async () => {
    mockApi(daySeries(31, "2026-10-01"));
    renderPage();
    expect(await screen.findByText(/Sem dados do relógio/)).toBeInTheDocument();
  });
});
