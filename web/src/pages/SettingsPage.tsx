import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useKeyStatus, useSaveKey, useSettings } from "../api/settings";

const KEY_URL = "https://connect.garmin.com/app/settings/personalApiToken";

function KeyStatus() {
  const settings = useSettings();
  const status = useKeyStatus();
  if (settings.isPending || status.isPending) {
    return <p className="muted">Verificando a conexão com a Garmin…</p>;
  }
  if (status.isSuccess) {
    return (
      <p className="settings-status settings-ok">
        <span aria-hidden="true">✓</span> Conta Garmin conectada e funcionando.
      </p>
    );
  }
  const code = status.error instanceof ApiError ? status.error.code : "unknown";
  if (code === "missing_key" || settings.data?.configured === false) {
    return (
      <div className="settings-welcome">
        <h2>Bem-vindo!</h2>
        <p>
          Para ver seus treinos, conecte sua conta Garmin com uma chave da Personal API. Leva um
          minuto.
        </p>
      </div>
    );
  }
  return (
    <p className="settings-status settings-bad">
      <span aria-hidden="true">!</span>{" "}
      {code === "auth_failed"
        ? "A chave salva foi recusada pela Garmin — provavelmente expirou. Cole uma nova abaixo."
        : `Não foi possível verificar a chave agora: ${status.error?.message ?? "erro desconhecido"}`}
    </p>
  );
}

export function SettingsPage() {
  const [key, setKey] = useState("");
  const save = useSaveKey();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    save.mutate(key.trim(), { onSuccess: () => setKey("") });
  }

  return (
    <section className="settings">
      <h1>Configuração</h1>
      <KeyStatus />

      <form className="panel settings-form" onSubmit={onSubmit}>
        <ol className="settings-steps">
          <li>
            No Garmin Connect,{" "}
            <a href={KEY_URL} target="_blank" rel="noopener noreferrer">
              gerar a chave da Personal API
            </a>
            . Escolha a validade (até 365 dias) e copie a chave — ela aparece uma única vez.
          </li>
          <li>Cole a chave abaixo e salve. Ela é testada com a Garmin antes de ser gravada.</li>
        </ol>

        <label htmlFor="api-key">Chave da Personal API</label>
        <div className="settings-row">
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="GCDC_…"
          />
          <button type="submit" disabled={!key.trim() || save.isPending}>
            {save.isPending ? "Validando…" : "Salvar chave"}
          </button>
        </div>

        {save.isSuccess && (
          <p role="status" className="settings-status settings-ok">
            <span aria-hidden="true">✓</span> Chave salva e validada. Seus dados já estão carregando
            — <a href="#/corrida">ver Corrida</a>.
          </p>
        )}
        {save.isError && (
          <p role="alert" className="settings-status settings-bad">
            <span aria-hidden="true">!</span> {save.error.message}
          </p>
        )}

        <p className="muted settings-privacy">
          A chave fica só neste computador, no arquivo <code>.env</code> do projeto, e só é usada
          para falar com a Garmin. Ela nunca volta para o navegador.
        </p>
      </form>
    </section>
  );
}
