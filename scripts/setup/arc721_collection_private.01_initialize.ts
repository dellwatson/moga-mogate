#!/usr/bin/env bun
// Setup step 01: initialize arc721 private collection via leo CLI

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

function toU64(raw: string, name: string): string {
  const value = raw.endsWith("u64") ? raw.slice(0, -3) : raw;
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid --${name} value '${raw}'. Expected unsigned integer.`);
  }
  return `${value}u64`;
}

function toField(raw: string): string {
  return raw.endsWith("field") ? raw : `${raw}field`;
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
  const admin = getArg("admin") || cfg.accounts.adminAddress;
  const maxMintable = toU64(
    getArg("max-mintable") || cfg.collectionDefaults.maxMintable,
    "max-mintable",
  );
  const maxFirstEdition = toU64(
    getArg("max-first-edition") || cfg.collectionDefaults.maxFirstEdition,
    "max-first-edition",
  );
  const symbol = toField(getArg("symbol") || cfg.collectionDefaults.symbol);
  const network = getArg("network") || cfg.network.name;
  const endpoint = getArg("endpoint") || cfg.network.endpoint;
  const privateKey = getArg("private-key") || cfg.network.privateKey;
  const dryRun = hasFlag("dry-run");
  const noBroadcast = hasFlag("no-broadcast");

  if (!admin) throw new Error("Missing --admin or setup.config.ts accounts.adminAddress");
  if (!privateKey && !dryRun) {
    throw new Error("Missing --private-key or setup.config.ts network.privateKey");
  }

  const args = [
    "execute",
    "initialize",
    admin,
    maxMintable,
    maxFirstEdition,
    symbol,
    "--private-key",
    privateKey || "<private-key>",
    "--network",
    network,
    "--endpoint",
    endpoint,
  ];
  if (!noBroadcast) args.push("--broadcast");

  console.log(getStepLabel("arc721CollectionPrivate", "01_initialize"));
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
