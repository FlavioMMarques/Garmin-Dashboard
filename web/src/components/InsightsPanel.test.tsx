import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InsightsPanel } from "./InsightsPanel";

describe("InsightsPanel", () => {
  it("groups every insight under a text heading for its tone", () => {
    render(
      <InsightsPanel
        insights={[
          { id: "a", tone: "attention", title: "Pouco tempo leve", detail: "Só 25% foi leve." },
          { id: "b", tone: "positive", title: "Mais eficiente", detail: "+4%." },
          { id: "c", tone: "positive", title: "Cadência subiu", detail: "160 → 165." },
          { id: "d", tone: "info", title: "Calor", detail: "11 s/km." },
        ]}
      />,
    );
    const attention = screen.getByRole("region", { name: /Atenção \(1\)/ });
    expect(within(attention).getByText("Pouco tempo leve")).toBeInTheDocument();
    const positive = screen.getByRole("region", { name: /Pontos positivos \(2\)/ });
    expect(within(positive).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("region", { name: /Observações \(1\)/ })).toBeInTheDocument();
  });

  it("omits empty groups", () => {
    render(
      <InsightsPanel
        insights={[{ id: "b", tone: "positive", title: "Mais eficiente", detail: "" }]}
      />,
    );
    expect(screen.queryByRole("region", { name: /Atenção/ })).not.toBeInTheDocument();
  });

  it("explains when there is not enough data", () => {
    render(<InsightsPanel insights={[]} />);
    expect(screen.getByText(/Ainda não há dados suficientes/)).toBeInTheDocument();
  });
});
