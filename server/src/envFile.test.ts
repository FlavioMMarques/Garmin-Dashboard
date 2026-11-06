import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPlausibleApiKey, upsertEnvValue, writeApiKey } from "./envFile.js";

describe("upsertEnvValue", () => {
  it("replaces an existing value and keeps everything else", () => {
    const before = "# comentário\nGARMIN_API_KEY=old\nPORT=8787\n";
    expect(upsertEnvValue(before, "GARMIN_API_KEY", "new")).toBe(
      "# comentário\nGARMIN_API_KEY=new\nPORT=8787\n",
    );
  });

  it("fills an empty value", () => {
    expect(upsertEnvValue("GARMIN_API_KEY=\nPORT=8787\n", "GARMIN_API_KEY", "abc")).toBe(
      "GARMIN_API_KEY=abc\nPORT=8787\n",
    );
  });

  it("appends the variable when missing, ending with a newline", () => {
    expect(upsertEnvValue("PORT=8787", "GARMIN_API_KEY", "abc")).toBe(
      "PORT=8787\nGARMIN_API_KEY=abc\n",
    );
    expect(upsertEnvValue("", "GARMIN_API_KEY", "abc")).toBe("GARMIN_API_KEY=abc\n");
  });

  it("does not touch commented-out or similarly named variables", () => {
    const before = "# GARMIN_API_KEY=example\nGARMIN_API_KEY_OLD=x\n";
    expect(upsertEnvValue(before, "GARMIN_API_KEY", "abc")).toBe(
      "# GARMIN_API_KEY=example\nGARMIN_API_KEY_OLD=x\nGARMIN_API_KEY=abc\n",
    );
  });

  it("preserves Windows line endings", () => {
    expect(upsertEnvValue("A=1\r\nGARMIN_API_KEY=old\r\n", "GARMIN_API_KEY", "n")).toBe(
      "A=1\r\nGARMIN_API_KEY=n\r\n",
    );
  });
});

describe("isPlausibleApiKey", () => {
  it("accepts the Personal API key alphabet", () => {
    expect(isPlausibleApiKey("GCDC_abc-123.def+ghi/jk=.42")).toBe(true);
  });

  it("rejects anything that could break or inject into .env", () => {
    for (const bad of ["", "a b", "abc\nPORT=1", "abc#comment", 'a"b', "x".repeat(1025)]) {
      expect(isPlausibleApiKey(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("writeApiKey", () => {
  const dir = () => mkdtempSync(join(tmpdir(), "garmin-env-"));

  it("creates .env from .env.example when missing", () => {
    const d = dir();
    writeFileSync(join(d, ".env.example"), "# exemplo\nGARMIN_API_KEY=\nPORT=8787\n");
    writeApiKey(join(d, ".env"), join(d, ".env.example"), "abc.123");
    expect(readFileSync(join(d, ".env"), "utf8")).toBe(
      "# exemplo\nGARMIN_API_KEY=abc.123\nPORT=8787\n",
    );
    expect(existsSync(join(d, ".env.tmp"))).toBe(false);
  });

  it("writes another variable without touching the Garmin key", () => {
    const d = dir();
    writeFileSync(join(d, ".env"), "GARMIN_API_KEY=garmin\nPORT=8787\n");
    writeApiKey(join(d, ".env"), join(d, ".env.example"), "AIza-1", "GEMINI_API_KEY");
    expect(readFileSync(join(d, ".env"), "utf8")).toBe(
      "GARMIN_API_KEY=garmin\nPORT=8787\nGEMINI_API_KEY=AIza-1\n",
    );
  });

  it("updates an existing .env in place", () => {
    const d = dir();
    writeFileSync(join(d, ".env"), "GARMIN_API_KEY=old\nPORT=9999\n");
    writeApiKey(join(d, ".env"), join(d, "missing.example"), "new");
    expect(readFileSync(join(d, ".env"), "utf8")).toBe("GARMIN_API_KEY=new\nPORT=9999\n");
  });

  it("refuses a malformed key", () => {
    const d = dir();
    expect(() => writeApiKey(join(d, ".env"), join(d, "x"), "a\nb")).toThrow();
    expect(existsSync(join(d, ".env"))).toBe(false);
  });
});
