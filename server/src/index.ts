import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createGarminClient } from "./garminClient.js";
import { writeApiKey } from "./envFile.js";
import { createRootApp } from "./root.js";

const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
const envExample = fileURLToPath(new URL("../../.env.example", import.meta.url));
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

const baseUrl = process.env.GARMIN_BASE_URL || "https://personal.connectapi.garmin.com";
const garmin = createGarminClient({
  apiKey: readApiKey,
  baseUrl,
  log: (msg) => console.log(`[garmin] ${msg}`),
});

const settings = {
  isConfigured: () => Boolean(readApiKey()),
  // A throwaway client: the key is only saved once Garmin accepts it.
  verifyKey: (key: string) => createGarminClient({ apiKey: key, baseUrl }).checkAuth(),
  saveKey: async (key: string) => writeApiKey(envFile, envExample, key),
};

// Production: also serve the built web app (npm start builds it first).
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
const app = createRootApp(
  createApp(garmin, { settings }),
  existsSync(`${webDist}/index.html`) ? webDist : null,
);

/** Open the dashboard in the default browser (fixed local URL, no shell interpolation of input). */
function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  spawn(cmd, args, { detached: true, stdio: "ignore" })
    .on("error", () => {})
    .unref();
}

const port = Number(process.env.PORT ?? 8787);
const server = serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  const url = `http://127.0.0.1:${info.port}`;
  console.log(`[server] Garmin Dashboard rodando em ${url}`);
  if (process.argv.includes("--open")) openBrowser(url);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[server] A porta ${port} já está em uso — o dashboard já está aberto? Feche a outra janela ou defina PORT no .env.`,
    );
    process.exit(1);
  }
  throw err;
});
