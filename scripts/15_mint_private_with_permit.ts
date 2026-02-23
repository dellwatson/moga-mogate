#!/usr/bin/env bun
// Execute mint_private_with_permit on mogate_auth_mint_permit.aleo.

import {
  createClientFromArgs,
  ensureScalarSuffix,
  getArg,
  isMain,
  readFileText,
} from "./aleo-utils.ts";

function ensureU64Suffix(value: string): string {
  return value.endsWith("u64") ? value : `${value}u64`;
}

function requireArg(name: string): string {
  const value = getArg(name);
  if (!value) {
    throw new Error(`Missing --${name}`);
  }
  return value;
}

function requireNftData(): string {
  const dataArg = getArg("data");
  if (dataArg) return dataArg;

  const dataFileArg = getArg("data-file");
  if (dataFileArg) {
    const fileText = readFileText(dataFileArg);
    if (fileText) return fileText;
  }

  const fallback = "mint_private.sample_data.leo";
  const fallbackText = readFileText(fallback);
  if (fallbackText) return fallbackText;

  throw new Error("Missing --data or --data-file, and fallback data file not found.");
}

async function main() {
  const client = await createClientFromArgs();
  const to = getArg("to") || client.getAddress();
  const nftData = requireNftData();
  const edition = ensureScalarSuffix(getArg("edition") || "1");
  const nonce = ensureU64Suffix(requireArg("nonce"));
  const signer = requireArg("signer");
  const signature = requireArg("signature");
  const program =
    getArg("program") || "mogate_auth_mint_permit.aleo";

  const txId = await client.executeBroadcast(
    program,
    "mint_private_with_permit",
    [to, nftData, edition, nonce, signer, signature],
    0,
    false,
  );

  console.log(`Program: ${program}`);
  console.log(`To: ${to}`);
  console.log(`Nonce: ${nonce}`);
  console.log(`Signer: ${signer}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
