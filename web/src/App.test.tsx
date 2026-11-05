import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows trends by default and marks the current tab", () => {
    window.location.hash = "";
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Tendências" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tendências" })).toHaveAttribute("aria-current", "page");
  });

  it("opens the page from the hash", () => {
    window.location.hash = "#/sono";
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Sono" })).toBeInTheDocument();
  });
});
