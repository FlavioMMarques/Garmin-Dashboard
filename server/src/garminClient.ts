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
  /** Raw bytes, e.g. an activity's zipped .FIT file. */
  getBinary(path: string): Promise<Buffer>;
  /** Forces a token exchange; used by /api/status. */
  checkAuth(): Promise<void>;
  /** Drops the cached token (e.g. after the key changed). */
  reset?(): void;
}

interface Options {
  /** The key, or a getter re-read on every token exchange (so a renewed key needs no restart). */
  apiKey: string | undefined | (() => string | undefined);
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
    const key = typeof apiKey === "function" ? apiKey() : apiKey;
    if (!key) throw new GarminError("missing_key", "GARMIN_API_KEY não configurada no .env");
    // No JSON Accept header: the endpoint returns the JWT as text/plain and answers 406 otherwise.
    const res = await fetchFn(baseUrl + TOKEN_PATH, {
      method: "POST",
      headers: { Authorization: `ApiKey ${key}` },
    });
    if (res.status === 401 || res.status === 403) {
      throw new GarminError(
        "auth_failed",
        "Chave da Personal API inválida ou expirada",
        res.status,
      );
    }
    if (!res.ok) throw upstreamError(res.status);

    const value = parseTokenBody(await res.text());
    if (!value) {
      log("resposta do token vazia ou em formato desconhecido");
      throw new GarminError("upstream", "Resposta inesperada do endpoint de token");
    }
    const expMs = jwtExpiryMs(value);
    const expiresAt = expMs ?? now() + DEFAULT_TTL_MS;
    log(`novo token obtido (válido por ${Math.round((expiresAt - now()) / 60_000)} min)`);
    return { value, expiresAt };
  }

  async function getToken(): Promise<string> {
    if (token && now() < token.expiresAt - REFRESH_MARGIN_MS) return token.value;
    pending ??= exchangeToken().finally(() => (pending = undefined));
    token = await pending;
    return token.value;
  }

  async function request(
    path: string,
    query: Query | undefined,
    accept: string,
    retried = false,
  ): Promise<Response> {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${await getToken()}`, Accept: accept },
    });
    if (res.status === 401 && !retried) {
      token = undefined;
      return request(path, query, accept, true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new GarminError("auth_failed", "Acesso negado pela Garmin", res.status);
    }
    if (!res.ok) throw upstreamError(res.status);
    return res;
  }

  return {
    async get<T>(path: string, query?: Query): Promise<T> {
      const res = await request(path, query, "application/json");
      if (res.status === 204) return null as T;
      return (await res.json()) as T;
    },
    async getBinary(path: string): Promise<Buffer> {
      // A JSON Accept makes the download service answer 406.
      const res = await request(path, undefined, "*/*");
      return Buffer.from(await res.arrayBuffer());
    },
    async checkAuth() {
      await getToken();
    },
    reset() {
      token = undefined;
    },
  };
}

/** Token comes as a raw JWT string; JSON bodies are accepted as a fallback. */
function parseTokenBody(raw: string): string | undefined {
  const text = raw.trim();
  if (!text.startsWith("{") && !text.startsWith('"')) return text || undefined;
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body === "string") return body || undefined;
    const obj = body as Record<string, unknown>;
    const value = obj.access_token ?? obj.accessToken ?? obj.token;
    return typeof value === "string" && value ? value : undefined;
  } catch {
    return undefined;
  }
}

function jwtExpiryMs(token: string): number | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: unknown };
    return typeof exp === "number" && exp > 0 ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function upstreamError(status: number): GarminError {
  return status === 429
    ? new GarminError("rate_limited", "Limite de requisições da Garmin atingido", 429)
    : new GarminError("upstream", `Garmin respondeu ${status}`, status);
}
