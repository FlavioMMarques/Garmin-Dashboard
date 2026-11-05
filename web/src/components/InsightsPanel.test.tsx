import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InsightsPanel } from "./InsightsPanel";

describe("InsightsPanel", () => {
  it("shows each insight with a text label for its tone", () => {
    render(
      <InsightsPanel
        insights={[
          { id: "a", tone: "attention", title: "Pouco tempo leve", detail: "Só 25% foi leve." },
          { id: "b", tone: "positive", title: "Mais eficiente", detail: "+4%." },
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: /Observações/ })).getAllByRole(
      "listitem",
    );
    expect(items[0]).toHaveTextContent("Atenção");
    expect(items[0]).toHaveTextContent("Pouco tempo leve");
    expect(items[1]).toHaveTextContent("Ponto positivo");
  });

  it("explains when there is not enough data", () => {
    render(<InsightsPanel insights={[]} />);
    expect(screen.getByText(/Ainda não há dados suficientes/)).toBeInTheDocument();
  });
});
