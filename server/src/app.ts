import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { GarminError, type GarminClient, type GarminErrorCode } from "./garminClient.js";
import { activitiesRoutes } from "./routes/activities.js";
import { runsRoutes } from "./routes/runs.js";
import { profileRoutes } from "./routes/profile.js";
import { dailyRoutes } from "./routes/daily.js";
import { sleepRoutes } from "./routes/sleep.js";
import { settingsRoutes, type SettingsDeps } from "./routes/settings.js";
import { localOnly } from "./localGuard.js";

export interface AppOptions {
  now?: () => number;
  /** Enables the settings routes (key status / save). */
  settings?: SettingsDeps;
}

const STATUS_BY_CODE: Record<GarminErrorCode, ContentfulStatusCode> = {
  missing_key: 503,
  auth_failed: 401,
  rate_limited: 429,
  upstream: 502,
};

export function createApp(garmin: GarminClient, options: AppOptions = {}) {
  const app = new Hono().basePath("/api");
  app.use("*", localOnly);
  // Route-level caches register here so a new key (maybe another account) clears them.
  const cacheResets: (() => void)[] = [];
  const onReset = (fn: () => void) => cacheResets.push(fn);

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

  app.route("/", activitiesRoutes(garmin));
  app.route("/", runsRoutes(garmin, { ...options, onReset }));
  app.route("/", profileRoutes(garmin, { ...options, onReset }));
  app.route("/", dailyRoutes(garmin, { ...options, onReset }));
  app.route("/", sleepRoutes(garmin, { ...options, onReset }));
  if (options.settings) {
    app.route(
      "/",
      settingsRoutes(garmin, options.settings, () => cacheResets.forEach((reset) => reset())),
    );
  }

  return app;
}
