// Aleo script helpers (root scripts)
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { ALEO_CONFIG } from "../ts-sdk/src/config.ts";

function normalizeEndpoint(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(testnet|mainnet|canary)(\/(testnet|mainnet|canary))*$/i, "");
}

export function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

export function applyEndpointOverrideFromArgs(): void {
  const endpointArg = getArg("endpoint");
  if (endpointArg && endpointArg.trim().length) {
    const normalized = normalizeEndpoint(endpointArg);
    process.env.ALEO_ENDPOINT = normalized;
    // Keep backwards-compat for older scripts that read ENDPOINT.
    process.env.ENDPOINT = normalized;
  }
}

export function applyRecordSearchOverridesFromArgs(): void {
  const windowArg = getArg("scan-window") || getArg("window");
  if (windowArg && windowArg.trim().length) {
    process.env.ALEO_RECORD_SCAN_WINDOW = windowArg.trim();
  }

  const skipRecentArg = getArg("skip-recent");
  if (skipRecentArg && skipRecentArg.trim().length) {
    process.env.ALEO_RECORD_SKIP_RECENT_BLOCKS = skipRecentArg.trim();
  }

  const startHeightArg = getArg("start-height");
  if (startHeightArg && startHeightArg.trim().length) {
    process.env.ALEO_RECORD_START_HEIGHT = startHeightArg.trim();
  }

  const endHeightArg = getArg("end-height");
  if (endHeightArg && endHeightArg.trim().length) {
    process.env.ALEO_RECORD_END_HEIGHT = endHeightArg.trim();
  }
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function isMain(importMetaUrl: string): boolean {
  const scriptPath = process.argv[1];
  if (!scriptPath) return false;
  const currentFile = fileURLToPath(importMetaUrl);
  return path.resolve(scriptPath) === path.resolve(currentFile);
}

export function ensureFieldSuffix(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new Error("Expected a field literal, got empty string. Example: 1field");
  }

  const raw = trimmed.endsWith("field") ? trimmed.slice(0, -5) : trimmed;
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `Expected a numeric field literal (e.g. 1field). Got: "${value}"`,
    );
  }

  // Normalize (strip leading zeros) by round-tripping through BigInt.
  return `${BigInt(raw)}field`;
}

export function ensureScalarSuffix(value: string): string {
  return value.endsWith("scalar") ? value : `${value}scalar`;
}

export function parseCsvU64(input?: string): number[] {
  if (!input) return [];
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((value) => Number(value));
}

export function formatU64Array(values: number[], length: number): string {
  const filled = Array.from({ length }, (_, i) => values[i] ?? 0);
  return `[${filled.map((value) => `${value}u64`).join(", ")}]`;
}

export function readFileText(path?: string): string | undefined {
  if (!path) return undefined;
  return fs.readFileSync(path, "utf8").trim();
}

export function resolvePrivateKey(): string {
  const keyArg = getArg("key");
  if (keyArg) return keyArg;

  const keyEnv = getArg("key-env");
  if (keyEnv && process.env[keyEnv]) return String(process.env[keyEnv]);

  const account = getArg("account") || getArg("acct");
  if (account === "2") {
    if (process.env.ALEO_PVT_KEY_2) return String(process.env.ALEO_PVT_KEY_2);
    throw new Error("ALEO_PVT_KEY_2 not set");
  }
  if (account === "3") {
    if (process.env.ALEO_PVT_KEY_3) return String(process.env.ALEO_PVT_KEY_3);
    throw new Error("ALEO_PVT_KEY_3 not set");
  }
  if (account && account !== "1") {
    throw new Error("Unknown account index. Use --account 1, 2, or 3.");
  }

  if (process.env.PRIVATE_KEY) return String(process.env.PRIVATE_KEY);
  if (process.env.ALEO_PVT_KEY) return String(process.env.ALEO_PVT_KEY);
  if (process.env.ALEO_PVT_KEY_2) return String(process.env.ALEO_PVT_KEY_2);
  if (process.env.ALEO_PVT_KEY_3) return String(process.env.ALEO_PVT_KEY_3);

  throw new Error(
    "Missing private key. Use --key, --key-env, --account, or set PRIVATE_KEY/ALEO_PVT_KEY(_2/_3).",
  );
}

export async function createClientFromArgs() {
  // Must run before importing the ts-sdk, since config reads env on module load.
  applyEndpointOverrideFromArgs();
  applyRecordSearchOverridesFromArgs();
  const key = resolvePrivateKey();
  const { createClient } = await import("../ts-sdk/src/client.ts");
  return createClient(key);
}

export function parseStructFields(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  const bodyStart = trimmed.indexOf("{");
  const bodyEnd = trimmed.lastIndexOf("}");
  if (bodyStart === -1 || bodyEnd === -1) return {};

  const body = trimmed.slice(bodyStart + 1, bodyEnd);
  const matches = body.match(/\w+\s*:\s*[^,]+/g) || [];
  const result: Record<string, string> = {};
  for (const match of matches) {
    const [key, value] = match.split(":").map((part) => part.trim());
    if (key && value) result[key] = value;
  }
  return result;
}

export function programNames() {
  return {
    arc721Private: ALEO_CONFIG.programs.arc721Private,
    rafflePrivate: ALEO_CONFIG.programs.rafflePrivate,
    gateway: ALEO_CONFIG.programs.gateway,
    bridge: ALEO_CONFIG.programs.bridge,
  } as const;
}
