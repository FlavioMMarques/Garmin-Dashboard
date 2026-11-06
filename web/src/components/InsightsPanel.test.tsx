import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("accepts a screen-specific empty message", () => {
    render(<InsightsPanel insights={[]} emptyMessage="Sem histórico para comparar este dia." />);
    expect(screen.getByText("Sem histórico para comparar este dia.")).toBeInTheDocument();
  });

  it("opens compact with a limit: attention first, then a button to see all", () => {
    render(
      <InsightsPanel
        limit={2}
        insights={[
          { id: "i", tone: "info", title: "Calor", detail: "" },
          { id: "p", tone: "positive", title: "Mais eficiente", detail: "" },
          { id: "a", tone: "attention", title: "Volume subiu", detail: "" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Atenção");
    expect(items[0]).toHaveTextContent("Volume subiu");
    expect(items[1]).toHaveTextContent("Mais eficiente");

    fireEvent.click(screen.getByRole("button", { name: "Ver todas as 3 observações" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("region", { name: /Observações \(1\)/ })).toBeInTheDocument();
  });
});
