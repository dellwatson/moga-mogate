#!/usr/bin/env bun
// Setup step 02: create a collection in arc721 multi private program via leo CLI

import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getSetupConfig, getStepLabel } from "./setup.config.ts";
import {
  encodeStringToFieldArray,
  formatFieldArray,
} from "../../ts-sdk/src/modules/index.ts";

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

function toU32(raw: string, name: string): string {
  const value = raw.endsWith("u32") ? raw.slice(0, -3) : raw;
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid --${name} value '${raw}'. Expected unsigned integer.`);
  }
  return `${value}u32`;
}

function parseBool(raw: string, name: string): string {
  if (raw === "true" || raw === "false") return raw;
  throw new Error(`Invalid --${name} value '${raw}'. Expected true/false.`);
}

function toField(raw: string, name: string): string {
  const value = raw.endsWith("field") ? raw : `${raw}field`;
  if (!/^\d+field$/.test(value)) {
    throw new Error(`Invalid --${name} value '${raw}'. Expected field literal.`);
  }
  return value;
}

function encodeText(raw: string, name: string): string {
  if (!raw) {
    throw new Error(`Missing --${name}`);
  }
  return formatFieldArray(encodeStringToFieldArray(raw));
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
  const admin = getArg("admin") || cfg.accounts.adminAddress;
  const nameText = getArg("name") || cfg.collectionDefaults.name;
  const symbolText = getArg("symbol") || cfg.collectionDefaults.symbolText;
  const metadataUrl = getArg("metadata-url") || cfg.collectionDefaults.metadataUrl;
  const isBridged = parseBool(
    getArg("bridged") || cfg.collectionDefaults.isBridged,
    "bridged",
  );
  const originChainId = toU32(
    getArg("origin-chain") || cfg.collectionDefaults.originChainId,
    "origin-chain",
  );
  const originCollection = encodeText(
    getArg("origin-collection") || cfg.collectionDefaults.originCollection,
    "origin-collection",
  );
  const maxMintable = toU64(
    getArg("max-mintable") || cfg.collectionDefaults.maxMintable,
    "max-mintable",
  );
  const maxFirstEdition = toU64(
    getArg("max-first-edition") || cfg.collectionDefaults.maxFirstEdition,
    "max-first-edition",
  );
  const network = getArg("network") || cfg.network.name;
  const endpoint = getArg("endpoint") || cfg.network.endpoint;
  const privateKey = getArg("private-key") || cfg.network.privateKey;
  const dryRun = hasFlag("dry-run");
  const noBroadcast = hasFlag("no-broadcast");

  if (!admin) throw new Error("Missing --admin or setup.config.ts accounts.adminAddress");
  if (!privateKey && !dryRun) {
    throw new Error("Missing --private-key or setup.config.ts network.privateKey");
  }

  const name = encodeText(nameText, "name");
  const symbol = encodeText(symbolText, "symbol");
  const metadata = encodeText(metadataUrl, "metadata-url");

  const args = [
    "execute",
    "create_collection",
    collectionId,
    admin,
    name,
    symbol,
    metadata,
    isBridged,
    originChainId,
    originCollection,
    maxMintable,
    maxFirstEdition,
    "--private-key",
    privateKey || "<private-key>",
    "--network",
    network,
    "--endpoint",
    endpoint,
  ];
  if (!noBroadcast) args.push("--broadcast");

  console.log(getStepLabel("arc721MultiPrivate", "02_create_collection"));
  console.log(`Program dir: ${programDir}`);
  console.log(`Collection:  ${collectionId}`);
  console.log(`Admin:       ${admin}`);
  console.log(`Name:        ${nameText}`);
  console.log(`Symbol:      ${symbolText}`);
  console.log(`Metadata:    ${metadataUrl}`);
  console.log(`Bridged:     ${isBridged}`);
  console.log(`OriginChain: ${originChainId}`);
  console.log(`OriginColl:  ${getArg("origin-collection") || cfg.collectionDefaults.originCollection}`);
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
