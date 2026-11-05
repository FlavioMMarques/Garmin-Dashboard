import { Hono } from "hono";
import { isPlausibleApiKey } from "../envFile.js";
import { GarminError, type GarminClient } from "../garminClient.js";
import { isLocalOrigin } from "../localGuard.js";

export interface SettingsDeps {
  /** Whether a key is currently configured (never the key itself). */
  isConfigured(): boolean;
  /** Exchange the key for a token with Garmin; throws GarminError when rejected. */
  verifyKey(key: string): Promise<void>;
  /** Persist the key (to .env). */
  saveKey(key: string): Promise<void>;
}

/**
 * Settings: the browser may send a typed key to this local server, which verifies it with
 * Garmin before saving and never sends it back.
 */
export function settingsRoutes(garmin: GarminClient, deps: SettingsDeps, onKeySaved: () => void) {
  return new Hono()
    .get("/settings", (c) => c.json({ configured: deps.isConfigured() }))
    .post("/settings/key", async (c) => {
      // CSRF: browsers always send Origin on cross-site POSTs; only this app's origin may write.
      const origin = c.req.header("origin");
      if (origin && !isLocalOrigin(origin)) {
        return c.json({ error: "forbidden", message: "Origem não permitida" }, 403);
      }
      // A JSON body can't be sent cross-site without a CORS preflight, which we never allow.
      if (!c.req.header("content-type")?.startsWith("application/json")) {
        return c.json({ error: "unsupported", message: "Envie JSON" }, 415);
      }
      const body = (await c.req.json().catch(() => null)) as { apiKey?: unknown } | null;
      const key = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
      if (!isPlausibleApiKey(key)) {
        return c.json(
          { error: "invalid_format", message: "Isso não parece uma chave da Personal API." },
          422,
        );
      }

      try {
        await deps.verifyKey(key);
      } catch (err) {
        if (err instanceof GarminError && err.code === "auth_failed") {
          return c.json(
            {
              error: "invalid_key",
              message: "A Garmin recusou essa chave. Confira se copiou inteira e se não expirou.",
            },
            422,
          );
        }
        throw err; // rate limit / upstream errors use the app's error mapping
      }

      try {
        await deps.saveKey(key);
      } catch (err) {
        // Log the failure without the key (fs errors carry the path, not the content).
        console.error("[settings] não foi possível salvar a chave:", (err as Error).message);
        return c.json(
          { error: "internal", message: "Não foi possível salvar o arquivo .env" },
          500,
        );
      }

      garmin.reset?.();
      onKeySaved();
      return c.json({ ok: true });
    });
}
