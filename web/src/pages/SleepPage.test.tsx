import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { daySeries, mkNight } from "../test/health";
import { SleepPage } from "./SleepPage";

const TODAY = new Date(2026, 10, 5);

function mockApi(
  days = daySeries(30, "2026-11-05", () => ({ sleep: mkNight({ totalS: 5.5 * 3600 }) })),
) {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => Response.json({ days }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SleepPage today={TODAY} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("SleepPage", () => {
  it("summarizes the last 30 nights with insights", async () => {
    const fetchMock = mockApi();
    renderPage();
    const summary = within(await screen.findByRole("group", { name: "Resumo do sono" }));
    expect(summary.getByText("Média por noite").closest(".stat-tile")).toHaveTextContent(
      "5 h 30 min",
    );
    expect(screen.getByText("Você dorme pouco, em média")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/wellness?from=2026-10-07&to=2026-11-05");
  });

  it("switches to 90 days", async () => {
    const fetchMock = mockApi();
    renderPage();
    await screen.findByRole("group", { name: "Resumo do sono" });
    fireEvent.click(screen.getByRole("button", { name: "90 dias" }));
    await vi.waitFor(() =>
      expect(String(fetchMock.mock.calls.at(-1)![0])).toBe(
        "/api/wellness?from=2026-08-08&to=2026-11-05",
      ),
    );
  });

  it("says when there are no nights", async () => {
    mockApi(daySeries(30, "2026-11-05", () => ({ sleep: null })));
    renderPage();
    expect(await screen.findByText(/Nenhuma noite registrada/)).toBeInTheDocument();
  });
});
