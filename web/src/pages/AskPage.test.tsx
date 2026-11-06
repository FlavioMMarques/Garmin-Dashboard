import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkRun } from "../test/runs";
import { AskPage } from "./AskPage";

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

/** The data endpoints the page summarises, plus whatever the test adds. */
function dataApi(extra: Record<string, Handler>) {
  return mockApi({
    "GET /api/runs": () => Response.json({ runs: [mkRun(1, "2026-11-05")] }),
    "GET /api/daily/range": () => Response.json({ days: [] }),
    "GET /api/sleep": () => Response.json({ nights: [] }),
    "GET /api/profile": () => Response.json({ firstName: "Flavio", firstDayOfWeek: "sunday" }),
    ...extra,
  });
}

const askBodies = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .filter(([url, init]) => String(url).endsWith("/api/ask") && init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init!.body)));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AskPage />
    </QueryClientProvider>,
  );
}

function ask(question: string) {
  fireEvent.change(screen.getByLabelText("Sua pergunta"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("AskPage", () => {
  it("asks for a Gemini key first, linking to where it is created", async () => {
    dataApi({ "GET /api/ask/settings": () => Response.json({ configured: false }) });
    renderPage();
    expect(await screen.findByLabelText("Chave do Gemini")).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: /criar uma chave/i })).toHaveAttribute(
      "href",
      "https://aistudio.google.com/apikey",
    );
    expect(screen.queryByLabelText("Sua pergunta")).not.toBeInTheDocument();
  });

  it("saves the key and then shows the question box", async () => {
    let configured = false;
    const fetchMock = dataApi({
      "GET /api/ask/settings": () => Response.json({ configured }),
      "POST /api/ask/key": () => {
        configured = true;
        return Response.json({ ok: true });
      },
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText("Chave do Gemini"), {
      target: { value: " AIza-key " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar chave" }));
    expect(await screen.findByLabelText("Sua pergunta")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/ask/key"))!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ apiKey: "AIza-key" });
  });

  it("sends the question with a summary of the dashboard data and shows the answer", async () => {
    const fetchMock = dataApi({
      "GET /api/ask/settings": () => Response.json({ configured: true }),
      "POST /api/ask": () => Response.json({ answer: "Você correu 6 km nesta semana." }),
    });
    renderPage();
    await screen.findByText(/dados prontos/i);
    ask("Quanto corri nesta semana?");

    expect(await screen.findByText("Você correu 6 km nesta semana.")).toBeInTheDocument();
    expect(screen.getByText("Quanto corri nesta semana?")).toBeInTheDocument();
    const [body] = askBodies(fetchMock);
    expect(body.question).toBe("Quanto corri nesta semana?");
    expect(body.history).toEqual([]);
    expect(body.context).toContain("Hoje:");
    expect(body.context).toContain("2026-11-05 07:00 | corrida | 6.00");
  });

  it("keeps the conversation so follow-up questions have context", async () => {
    const fetchMock = dataApi({
      "GET /api/ask/settings": () => Response.json({ configured: true }),
      "POST /api/ask": () => Response.json({ answer: "Resposta." }),
    });
    renderPage();
    await screen.findByText(/dados prontos/i);
    ask("Primeira?");
    await screen.findByText("Resposta.");
    ask("E depois?");
    await waitFor(() => expect(askBodies(fetchMock)).toHaveLength(2));
    expect(askBodies(fetchMock)[1].history).toEqual([
      { role: "user", text: "Primeira?" },
      { role: "model", text: "Resposta." },
    ]);
  });

  it("asks a suggested question with one click", async () => {
    const fetchMock = dataApi({
      "GET /api/ask/settings": () => Response.json({ configured: true }),
      "POST /api/ask": () => Response.json({ answer: "ok" }),
    });
    renderPage();
    await screen.findByText(/dados prontos/i);
    const suggestion = screen.getAllByRole("button", { name: /\?$/ })[0]!;
    fireEvent.click(suggestion);
    await waitFor(() => expect(askBodies(fetchMock)).toHaveLength(1));
    expect(askBodies(fetchMock)[0].question).toBe(suggestion.textContent);
  });

  it("explains the free-tier limit and keeps the question to retry", async () => {
    dataApi({
      "GET /api/ask/settings": () => Response.json({ configured: true }),
      "POST /api/ask": () =>
        Response.json(
          { error: "gemini_rate_limited", message: "Limite gratuito do Gemini atingido." },
          { status: 429 },
        ),
    });
    renderPage();
    await screen.findByText(/dados prontos/i);
    ask("Como está meu sono?");
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite gratuito do Gemini");
    expect(screen.getByLabelText("Sua pergunta")).toHaveValue("Como está meu sono?");
  });

  it("tells the user what leaves the computer", async () => {
    dataApi({ "GET /api/ask/settings": () => Response.json({ configured: true }) });
    renderPage();
    expect(await screen.findByText(/enviado ao Google/i)).toBeInTheDocument();
  });
});
