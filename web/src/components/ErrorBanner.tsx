import type { ReactNode } from "react";
import { ApiError } from "../api/client";

const KEY_URL = "https://connect.garmin.com/app/settings/personalApiToken";

function KeySteps() {
  return (
    <ol className="banner-steps">
      <li>
        No Garmin Connect,{" "}
        <a href={KEY_URL} target="_blank" rel="noopener noreferrer">
          gerar a chave da Personal API
        </a>{" "}
        (ela aparece uma única vez — copie na hora).
      </li>
      <li>
        No arquivo <code>.env</code> do projeto, cole em <code>GARMIN_API_KEY=</code> e salve.
      </li>
      <li>Clique em “Tentar de novo” — não precisa reiniciar o servidor.</li>
    </ol>
  );
}

function describe(error: Error): { title: string; body: ReactNode } {
  const code = error instanceof ApiError ? error.code : "unknown";
  switch (code) {
    case "missing_key":
      return { title: "Chave da Garmin não configurada", body: <KeySteps /> };
    case "auth_failed":
      return {
        title: "A chave da Garmin é inválida ou expirou",
        body: (
          <>
            <p>As chaves valem de 30 a 365 dias, conforme escolhido ao gerar. Gere uma nova:</p>
            <KeySteps />
          </>
        ),
      };
    case "rate_limited":
      return {
        title: "Limite de requisições da Garmin atingido",
        body: <p>Espere alguns minutos e tente de novo.</p>,
      };
    case "offline":
      return {
        title: "O servidor local não está respondendo",
        body: (
          <p>
            Na pasta do projeto, rode <code>npm run dev</code> e tente de novo.
          </p>
        ),
      };
    default:
      return { title: "Não foi possível carregar os dados", body: <p>{error.message}</p> };
  }
}

/** Explains what went wrong and what to do next — never a blank screen. */
export function ErrorBanner({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { title, body } = describe(error);
  return (
    <div className="banner-error" role="alert">
      <strong className="banner-title">{title}</strong>
      {body}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}
