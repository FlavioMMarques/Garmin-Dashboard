import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createGarminClient } from "./garminClient.js";

const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
try {
  process.loadEnvFile(envFile);
} catch {
  console.warn("[server] .env não encontrado — copie .env.example para .env");
}

const garmin = createGarminClient({
  apiKey: process.env.GARMIN_API_KEY,
  baseUrl: process.env.GARMIN_BASE_URL || "https://personal.connectapi.garmin.com",
  log: (msg) => console.log(`[garmin] ${msg}`),
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp(garmin).fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`[server] http://127.0.0.1:${info.port}`);
});
