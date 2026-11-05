import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

/**
 * Personal API keys use a URL/base64-like alphabet. Anything else (spaces, newlines, '#',
 * quotes) is rejected so a pasted value can never break or inject lines into .env.
 */
export function isPlausibleApiKey(value: string): boolean {
  return /^[A-Za-z0-9._+/=-]{1,1024}$/.test(value);
}

/** Set `name=value` in .env content, keeping comments, other variables and line endings. */
export function upsertEnvValue(content: string, name: string, value: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const i = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (i >= 0) lines[i] = `${name}=${value}`;
  else lines.push(`${name}=${value}`);
  return lines.join(eol) + eol;
}

/**
 * Write GARMIN_API_KEY into .env (created from .env.example when missing). Writes a temp
 * file and renames it, so a crash never leaves a half-written .env behind.
 */
export function writeApiKey(envPath: string, examplePath: string, key: string): void {
  if (!isPlausibleApiKey(key)) throw new Error("invalid key format");
  const source = existsSync(envPath) ? envPath : existsSync(examplePath) ? examplePath : null;
  const current = source ? readFileSync(source, "utf8") : "";
  const tmp = `${envPath}.tmp`;
  writeFileSync(tmp, upsertEnvValue(current, "GARMIN_API_KEY", key), { mode: 0o600 });
  renameSync(tmp, envPath);
}
