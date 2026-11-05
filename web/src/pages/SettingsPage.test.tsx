import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

type Handler = (url: string, init?: RequestInit) => Response;

function mockApi(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const path = new URL(input, "http://x").pathname;
    const handler = handlers[`${init?.method ?? "GET"} ${path}`];
    return handler ? handler(input, init) : Response.json({}, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("SettingsPage", () => {
  it("welcomes a first-time user and links to where the key is generated", async () => {
    mockApi({
      "GET /api/settings": () => Response.json({ configured: false }),
      "GET /api/status": () =>
        Response.json({ error: "missing_key", message: "sem chave" }, { status: 503 }),
    });
    renderPage();
    expect(await screen.findByText(/Bem-vindo/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gerar a chave/i })).toHaveAttribute(
      "href",
      "https://connect.garmin.com/app/settings/personalApiToken",
    );
    expect(screen.getByLabelText("Chave da Personal API")).toHaveAttribute("type", "password");
  });

  it("shows that a configured key is working", async () => {
    mockApi({
      "GET /api/settings": () => Response.json({ configured: true }),
      "GET /api/status": () => Response.json({ ok: true }),
    });
    renderPage();
    expect(await screen.findByText(/conectada e funcionando/)).toBeInTheDocument();
  });

  it("saves a key as JSON and confirms", async () => {
    const fetchMock = mockApi({
      "GET /api/settings": () => Response.json({ configured: false }),
      "GET /api/status": () =>
        Response.json({ error: "missing_key", message: "" }, { status: 503 }),
      "POST /api/settings/key": () => Response.json({ ok: true }),
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText("Chave da Personal API"), {
      target: { value: "GCDC_nova.chave" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar chave" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Chave salva e validada");
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === "POST")!;
    expect(new Headers(init!.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init!.body))).toEqual({ apiKey: "GCDC_nova.chave" });
    expect(screen.getByLabelText("Chave da Personal API")).toHaveValue("");
  });

  it("shows why Garmin rejected the key", async () => {
    mockApi({
      "GET /api/settings": () => Response.json({ configured: true }),
      "GET /api/status": () => Response.json({ ok: true }),
      "POST /api/settings/key": () =>
        Response.json(
          { error: "invalid_key", message: "A Garmin recusou essa chave." },
          { status: 422 },
        ),
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText("Chave da Personal API"), {
      target: { value: "GCDC_ruim" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar chave" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A Garmin recusou essa chave.");
  });
});
