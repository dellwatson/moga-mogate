#!/usr/bin/env bun
// Setup step 03: set minter for a collection in arc721 multi private program via leo CLI

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
  if (raw === "true" || raw === "false") return raw;
  throw new Error(`Invalid --allowed value '${raw}'. Expected true/false.`);
}

function toField(raw: string, name: string): string {
  const value = raw.endsWith("field") ? raw : `${raw}field`;
  if (!/^\d+field$/.test(value)) {
    throw new Error(`Invalid --${name} value '${raw}'. Expected field literal.`);
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
  const programDir = getArg("program-dir") || cfg.programs.arc721MultiProgramDir;
  const collectionId = toField(
    getArg("collection") || getArg("collection-id") || cfg.collectionDefaults.collectionId,
    "collection",
  );
  const minter = getArg("minter") || cfg.programs.authorityProgramId;
  const allowed = parseBool(getArg("allowed") || cfg.gatewayDefaults.allowed);
  const network = getArg("network") || cfg.network.name;
  const endpoint = getArg("endpoint") || cfg.network.endpoint;
  const privateKey = getArg("private-key") || cfg.network.privateKey;
  const dryRun = hasFlag("dry-run");
  const noBroadcast = hasFlag("no-broadcast");

  if (!minter) throw new Error("Missing --minter or setup.config.ts programs.authorityProgramId");
  if (!privateKey && !dryRun) {
    throw new Error("Missing --private-key or setup.config.ts network.privateKey");
  }

  const args = [
    "execute",
    "set_minter",
    collectionId,
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

  console.log(getStepLabel("arc721MultiPrivate", "03_set_minter"));
  console.log(`Program dir: ${programDir}`);
  console.log(`Collection:  ${collectionId}`);
  console.log(`Minter:      ${minter}`);
  console.log(`Allowed:     ${allowed}`);
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
