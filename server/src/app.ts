import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { GarminError, type GarminClient, type GarminErrorCode } from "./garminClient.js";

const STATUS_BY_CODE: Record<GarminErrorCode, ContentfulStatusCode> = {
  missing_key: 503,
  auth_failed: 401,
  rate_limited: 429,
  upstream: 502,
};

export function createApp(garmin: GarminClient) {
  const app = new Hono().basePath("/api");

  app.onError((err, c) => {
    if (err instanceof GarminError) {
      return c.json({ error: err.code, message: err.message }, STATUS_BY_CODE[err.code]);
    }
    console.error("[server]", err);
    return c.json({ error: "internal", message: "Erro interno no servidor local" }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/status", async (c) => {
    await garmin.checkAuth();
    return c.json({ ok: true });
  });

  return app;
}
