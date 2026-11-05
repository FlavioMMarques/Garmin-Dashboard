import type { MiddlewareHandler } from "hono";

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
