import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createGarminClient } from "./garminClient.js";

const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
try {
  process.loadEnvFile(envFile);
} catch {
  console.warn("[server] .env não encontrado — copie .env.example para .env");
}

/** Re-read .env on each token exchange so a renewed key is picked up without a restart. */
function readApiKey(): string | undefined {
  try {
    return parseEnv(readFileSync(envFile, "utf8")).GARMIN_API_KEY || undefined;
  } catch {
    return process.env.GARMIN_API_KEY;
  }
}

const garmin = createGarminClient({
  apiKey: readApiKey,
  baseUrl: process.env.GARMIN_BASE_URL || "https://personal.connectapi.garmin.com",
  log: (msg) => console.log(`[garmin] ${msg}`),
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp(garmin).fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`[server] http://127.0.0.1:${info.port}`);
});
