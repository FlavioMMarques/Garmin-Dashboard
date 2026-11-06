import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAsk, useAskSettings, useSaveGeminiKey, type ChatTurn } from "../api/ask";
import { ApiError } from "../api/client";
import { useDailyRange } from "../api/daily";
import { useProfile } from "../api/profile";
import { useRuns } from "../api/runs";
import { useSleep } from "../api/sleep";
import { buildAskContext } from "../lib/askContext";
import { localDateKey, shiftDate } from "../lib/health";
import { weekStartsOnFrom } from "../lib/volume";

const KEY_URL = "https://aistudio.google.com/apikey";
const HEALTH_DAYS = 90;

const SUGGESTIONS = [
  "Como evoluiu meu ritmo nos últimos meses?",
  "Estou dormindo pouco antes dos treinos longos?",
  "Meu volume semanal está subindo rápido demais?",
  "O que meus dados de sono e VFC dizem sobre minha recuperação?",
];

function GeminiKeyForm() {
  const [key, setKey] = useState("");
  const save = useSaveGeminiKey();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (key.trim()) save.mutate(key.trim(), { onSuccess: () => setKey("") });
  }

  return (
    <form className="panel settings-form" onSubmit={onSubmit}>
      <ol className="settings-steps">
        <li>
          No Google AI Studio,{" "}
          <a href={KEY_URL} target="_blank" rel="noopener noreferrer">
            criar uma chave de API
          </a>{" "}
          (gratuita; basta uma conta Google).
        </li>
        <li>Cole a chave abaixo e salve. Ela é testada com o Google antes de ser gravada.</li>
      </ol>
      <label htmlFor="gemini-key">Chave do Gemini</label>
      <div className="settings-row">
        <input
          id="gemini-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza…"
        />
        <button type="submit" disabled={!key.trim() || save.isPending}>
          {save.isPending ? "Validando…" : "Salvar chave"}
        </button>
      </div>
      {save.isError && (
        <p role="alert" className="settings-status settings-bad">
          <span aria-hidden="true">!</span> {save.error.message}
        </p>
      )}
      <p className="muted settings-privacy">
        A chave fica só neste computador, no arquivo <code>.env</code> do projeto.
      </p>
    </form>
  );
}

export function AskPage() {
  const settings = useAskSettings();
  const today = localDateKey(new Date());
  const runs = useRuns(shiftDate(today, -365));
  const days = useDailyRange(shiftDate(today, -(HEALTH_DAYS - 1)), today);
  const nights = useSleep(shiftDate(today, -(HEALTH_DAYS - 1)), today);
  const weekStartsOn = weekStartsOnFrom(useProfile().data?.firstDayOfWeek);

  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const ask = useAsk();
  const endRef = useRef<HTMLDivElement>(null);

  // A source that failed just leaves its section empty ("sem dados"); the rest still helps.
  const loading = runs.isPending || days.isPending || nights.isPending;
  const context = useMemo(
    () =>
      buildAskContext({
        today,
        runs: runs.data ?? [],
        days: days.data ?? [],
        nights: nights.data ?? [],
        weekStartsOn,
      }),
    [today, runs.data, days.data, nights.data, weekStartsOn],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [history, ask.isPending]);

  function send(text: string) {
    const q = text.trim();
    if (!q || ask.isPending || loading) return;
    setQuestion(q);
    ask.mutate(
      { question: q, history, context },
      {
        onSuccess: (answer) => {
          setHistory((h) => [...h, { role: "user", text: q }, { role: "model", text: answer }]);
          setQuestion("");
        },
      },
    );
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(question);
    }
  }

  const keyProblem =
    ask.error instanceof ApiError &&
    (ask.error.code === "gemini_missing_key" || ask.error.code === "gemini_invalid_key");

  return (
    <section className="ask">
      <div className="page-header">
        <div>
          <h1>Pergunte</h1>
          <p className="page-subtitle">
            Pergunte sobre seus treinos, sua saúde e seu sono · respostas do Gemini (Google)
          </p>
        </div>
        {history.length > 0 && (
          <div className="toolbar">
            <button type="button" onClick={() => (setHistory([]), ask.reset())}>
              Nova conversa
            </button>
          </div>
        )}
      </div>

      {settings.isPending ? (
        <p className="muted">Verificando a configuração…</p>
      ) : !settings.data?.configured || keyProblem ? (
        <>
          {keyProblem && (
            <p role="alert" className="settings-status settings-bad">
              <span aria-hidden="true">!</span> {ask.error!.message} Cole uma chave nova abaixo.
            </p>
          )}
          <GeminiKeyForm />
        </>
      ) : (
        <>
          <div className="ask-thread" aria-live="polite">
            {history.length === 0 && !ask.isPending && (
              <div className="ask-suggestions">
                <p className="muted">
                  {loading
                    ? "Carregando seus dados…"
                    : "Seus dados prontos para análise. Experimente:"}
                </p>
                <div className="ask-chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" disabled={loading} onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {history.map((t, i) => (
              <div key={i} className={`ask-msg ask-${t.role}`}>
                {t.text}
              </div>
            ))}
            {ask.isPending && <div className="ask-msg ask-user">{question}</div>}
            {ask.isPending && <p className="muted ask-thinking">Analisando seus dados…</p>}
            {ask.isError && !keyProblem && (
              <p role="alert" className="settings-status settings-bad">
                <span aria-hidden="true">!</span> {ask.error.message}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="ask-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(question);
            }}
          >
            <label htmlFor="ask-question" className="visually-hidden">
              Sua pergunta
            </label>
            <textarea
              id="ask-question"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ex.: por que meu ritmo piorou em outubro?"
              maxLength={2000}
            />
            <button type="submit" disabled={!question.trim() || ask.isPending || loading}>
              Perguntar
            </button>
          </form>
          <p className="muted ask-privacy">
            Ao perguntar, um resumo dos seus dados (corridas dos últimos 12 meses, saúde e sono dos
            últimos {HEALTH_DAYS} dias) é enviado ao Google. No plano gratuito o Google pode usar
            esse conteúdo para melhorar os produtos dele, e revisores humanos podem lê-lo. A IA pode
            errar: confira os números nas outras telas.
          </p>
        </>
      )}
    </section>
  );
}
