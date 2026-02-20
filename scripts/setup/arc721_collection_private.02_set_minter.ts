#!/usr/bin/env bun
// Setup step 02: set minter for arc721 private collection via leo CLI

import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getSetupConfig, getStepLabel } from "./setup.config.ts";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseBool(raw: string): string {
  const value = raw.toLowerCase();
  if (value !== "true" && value !== "false") {
    throw new Error(`Invalid --allowed '${raw}'. Use true or false.`);
  }
  return value;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "../..");

function resolveProgramDir(programDir: string): string {
  return isAbsolute(programDir) ? programDir : resolve(ROOT_DIR, programDir);
}

function main() {
  const cfg = getSetupConfig();
  const programDir = getArg("program-dir") || cfg.programs.arc721ProgramDir;
  const minter = getArg("minter") || cfg.gatewayDefaults.minterProgramId;
  const allowed = parseBool(getArg("allowed") || cfg.gatewayDefaults.allowed);
  const network = getArg("network") || cfg.network.name;
  const endpoint = getArg("endpoint") || cfg.network.endpoint;
  const privateKey = getArg("private-key") || cfg.network.privateKey;
  const dryRun = hasFlag("dry-run");
  const noBroadcast = hasFlag("no-broadcast");

  if (!privateKey && !dryRun) {
    throw new Error("Missing --private-key or setup.config.ts network.privateKey");
  }

  const args = [
    "execute",
    "set_minter",
    minter,
    allowed,
    "--private-key",
    privateKey || "<private-key>",
    "--network",
    network,
    "--endpoint",
    endpoint,
  ];
  if (!noBroadcast) args.push("--broadcast");

  console.log(getStepLabel("arc721CollectionPrivate", "02_set_minter"));
  console.log(`Program dir: ${programDir}`);
  console.log(`Args: ${args.join(" ")}`);

  if (dryRun) return;

  const resolvedProgramDir = resolveProgramDir(programDir);

  const result = spawnSync("leo", args, {
    stdio: "inherit",
    cwd: resolvedProgramDir,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  main();
} catch (error) {
  console.error("Setup failed:", error);
  process.exit(1);
}
