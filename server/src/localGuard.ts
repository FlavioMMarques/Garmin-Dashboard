import type { Context, MiddlewareHandler } from "hono";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * The server only listens on 127.0.0.1, but a malicious page can still point its own
 * domain at 127.0.0.1 (DNS rebinding) and read the API. Requiring a local Host header
 * on every request closes that.
 */
export const localOnly: MiddlewareHandler = async (c, next) => {
  if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname)) {
    return c.json(
      { error: "forbidden", message: "Acesso permitido só pelo próprio computador" },
      403,
    );
  }
  await next();
};

/**
 * Guard for state-changing POSTs: browsers always send Origin on cross-site requests, so only
 * this app's origin may write; and a JSON body can't be sent cross-site without a CORS
 * preflight, which we never allow. Returns the error response, or null when the request is OK.
 */
export function rejectCrossSiteWrite(c: Context): Response | null {
  const origin = c.req.header("origin");
  if (origin && !isLocalOrigin(origin)) {
    return c.json({ error: "forbidden", message: "Origem não permitida" }, 403);
  }
  if (!c.req.header("content-type")?.startsWith("application/json")) {
    return c.json({ error: "unsupported", message: "Envie JSON" }, 415);
  }
  return null;
}
