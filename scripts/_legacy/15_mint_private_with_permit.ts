#!/usr/bin/env bun
// Execute mint_private_with_permit on mogate_auth_mint_permit.aleo.

import {
  createClientFromArgs,
  ensureFieldSuffix,
  ensureScalarSuffix,
  getArg,
  isMain,
  readFileText,
} from "./aleo-utils.ts";
import { buildNftDataFromMetadataUrl } from "../ts-sdk/src/modules/index.ts";

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

function resolveNftData(): string {
  const metadataUrl = getArg("metadata-url");
  if (metadataUrl) {
    return buildNftDataFromMetadataUrl(metadataUrl);
  }
  return requireNftData();
}

function requireCollectionId(): string {
  const raw = getArg("collection") || getArg("collection-id") || getArg("collectionId");
  if (!raw) {
    throw new Error("Missing --collection <field> (collection_id).");
  }
  return ensureFieldSuffix(raw);
}

async function main() {
  const client = await createClientFromArgs();
  const collectionId = requireCollectionId();
  const to = getArg("to") || client.getAddress();
  const nftData = resolveNftData();
  const edition = ensureScalarSuffix(getArg("edition") || "1");
  const nonce = ensureU64Suffix(requireArg("nonce"));
  const signer = requireArg("signer");
  const signature = requireArg("signature");
  const program =
    getArg("program") || "mogate_auth_mint_permit_v2.aleo";

  const txId = await client.executeBroadcast(
    program,
    "mint_private_with_permit",
    [collectionId, to, nftData, edition, nonce, signer, signature],
    0,
    false,
  );

  console.log(`Program: ${program}`);
  console.log(`Collection: ${collectionId}`);
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
