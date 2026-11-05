const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";
const DEFAULT_TTL_MS = 24 * 60 * 60_000;
const REFRESH_MARGIN_MS = 5 * 60_000;

export type GarminErrorCode = "missing_key" | "auth_failed" | "rate_limited" | "upstream";

export class GarminError extends Error {
  constructor(
    readonly code: GarminErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GarminError";
  }
}

export type Query = Record<string, string | number | boolean | undefined>;

export interface GarminClient {
  get<T>(path: string, query?: Query): Promise<T>;
  /** Forces a token exchange; used by /api/status. */
  checkAuth(): Promise<void>;
}

interface Options {
  apiKey: string | undefined;
  baseUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
  log?: (msg: string) => void;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

export function createGarminClient({
  apiKey,
  baseUrl,
  fetch: fetchFn = fetch,
  now = Date.now,
  log = () => {},
}: Options): GarminClient {
  let token: CachedToken | undefined;
  let pending: Promise<CachedToken> | undefined;

  async function exchangeToken(): Promise<CachedToken> {
    if (!apiKey) throw new GarminError("missing_key", "GARMIN_API_KEY não configurada no .env");
    const res = await fetchFn(baseUrl + TOKEN_PATH, {
      method: "POST",
      headers: { Authorization: `ApiKey ${apiKey}`, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      throw new GarminError("auth_failed", "Chave da Personal API inválida ou expirada", res.status);
    }
    if (!res.ok) throw upstreamError(res.status);

    const body = (await res.json()) as Record<string, unknown>;
    const value = body.access_token ?? body.accessToken ?? body.token;
    if (typeof value !== "string") {
      log(`resposta do token sem campo conhecido; campos: ${Object.keys(body).join(", ")}`);
      throw new GarminError("upstream", "Resposta inesperada do endpoint de token");
    }
    const expiresIn = Number(body.expires_in ?? body.expiresIn);
    const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : DEFAULT_TTL_MS;
    log(`novo token obtido (válido por ${Math.round(ttl / 60_000)} min)`);
    return { value, expiresAt: now() + ttl };
  }

  async function getToken(): Promise<string> {
    if (token && now() < token.expiresAt - REFRESH_MARGIN_MS) return token.value;
    pending ??= exchangeToken().finally(() => (pending = undefined));
    token = await pending;
    return token.value;
  }

  async function request(path: string, query: Query | undefined, retried: boolean): Promise<Response> {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${await getToken()}`, Accept: "application/json" },
    });
    if (res.status === 401 && !retried) {
      token = undefined;
      return request(path, query, true);
    }
    return res;
  }

  return {
    async get<T>(path: string, query?: Query): Promise<T> {
      const res = await request(path, query, false);
      if (res.status === 401 || res.status === 403) {
        throw new GarminError("auth_failed", "Acesso negado pela Garmin", res.status);
      }
      if (!res.ok) throw upstreamError(res.status);
      if (res.status === 204) return null as T;
      return (await res.json()) as T;
    },
    async checkAuth() {
      await getToken();
    },
  };
}

function upstreamError(status: number): GarminError {
  return status === 429
    ? new GarminError("rate_limited", "Limite de requisições da Garmin atingido", 429)
    : new GarminError("upstream", `Garmin respondeu ${status}`, status);
}
