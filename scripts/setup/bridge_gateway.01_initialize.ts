#!/usr/bin/env bun
// Setup step 01: initialize bridge gateway via leo CLI

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "../..");

function resolveProgramDir(programDir: string): string {
  return isAbsolute(programDir) ? programDir : resolve(ROOT_DIR, programDir);
}

function main() {
  const cfg = getSetupConfig();
  const programDir = getArg("program-dir") || cfg.programs.bridgeProgramDir;
  const admin = getArg("admin") || cfg.accounts.adminAddress;
  const relayer = getArg("relayer") || cfg.accounts.backendAddress;
  const network = getArg("network") || cfg.network.name;
  const endpoint = getArg("endpoint") || cfg.network.endpoint;
  const privateKey = getArg("private-key") || cfg.network.privateKey;
  const dryRun = hasFlag("dry-run");
  const noBroadcast = hasFlag("no-broadcast");

  if (!admin) throw new Error("Missing --admin or setup.config.ts accounts.adminAddress");
  if (!relayer) throw new Error("Missing --relayer or setup.config.ts accounts.backendAddress");
  if (!privateKey && !dryRun) {
    throw new Error("Missing --private-key or setup.config.ts network.privateKey");
  }

  const args = [
    "execute",
    "initialize",
    admin,
    relayer,
    "--private-key",
    privateKey || "<private-key>",
    "--network",
    network,
    "--endpoint",
    endpoint,
  ];
  if (!noBroadcast) args.push("--broadcast");

  console.log(getStepLabel("bridgeGateway", "01_initialize"));
  console.log(`Program dir: ${programDir}`);
  console.log(`Admin:       ${admin}`);
  console.log(`Relayer:     ${relayer}`);
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
