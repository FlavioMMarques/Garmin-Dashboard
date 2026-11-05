import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { App } from "./App";

vi.stubGlobal(
  "fetch",
  vi.fn(async () => Response.json({ runs: [] })),
);

function withQuery(ui: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;
}

describe("App", () => {
  it("shows running by default and marks the current tab", () => {
    window.location.hash = "";
    render(withQuery(<App />));
    expect(screen.getByRole("heading", { level: 1, name: "Corrida" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Corrida" })).toHaveAttribute("aria-current", "page");
  });

  it("opens Configuração on first run, when no key is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).endsWith("/api/settings")
          ? Response.json({ configured: false })
          : Response.json({ runs: [] }),
      ),
    );
    window.location.hash = "#/corrida";
    render(withQuery(<App />));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Configuração" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/configuracao");
  });

  it("opens the page from the hash", () => {
    window.location.hash = "#/sono";
    render(withQuery(<App />));
    expect(screen.getByRole("heading", { level: 1, name: "Sono" })).toBeInTheDocument();
  });
});
