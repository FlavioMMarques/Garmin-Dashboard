import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { ErrorBanner } from "./ErrorBanner";

const KEY_URL = "https://connect.garmin.com/app/settings/personalApiToken";

describe("ErrorBanner", () => {
  it("guides through creating a key when none is configured", () => {
    render(<ErrorBanner error={new ApiError("missing_key", "sem chave", 503)} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Chave da Garmin não configurada");
    expect(screen.getByRole("link", { name: /gerar a chave/i })).toHaveAttribute("href", KEY_URL);
    expect(screen.getByRole("link", { name: "Configuração" })).toHaveAttribute(
      "href",
      "#/configuracao",
    );
    expect(alert).not.toHaveTextContent(".env");
  });

  it("explains an expired or invalid key with the same steps", () => {
    render(<ErrorBanner error={new ApiError("auth_failed", "negado", 401)} />);
    expect(screen.getByRole("alert")).toHaveTextContent("inválida ou expirou");
    expect(screen.getByRole("link", { name: /gerar a chave/i })).toHaveAttribute("href", KEY_URL);
  });

  it("tells the user to start the local server when it is offline", () => {
    render(<ErrorBanner error={new ApiError("offline", "sem servidor", 0)} />);
    expect(screen.getByRole("alert")).toHaveTextContent("npm run dev");
  });

  it("asks to wait on rate limiting", () => {
    render(<ErrorBanner error={new ApiError("rate_limited", "limite", 429)} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/alguns minutos/);
  });

  it("falls back to the server message for other errors", () => {
    render(<ErrorBanner error={new ApiError("upstream", "Garmin respondeu 500", 502)} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Garmin respondeu 500");
  });

  it("retries on demand", () => {
    const onRetry = vi.fn();
    render(<ErrorBanner error={new Error("boom")} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
