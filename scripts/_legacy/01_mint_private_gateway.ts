#!/usr/bin/env bun
// Mint private NFT via authority mint gateway

import {
  createClientFromArgs,
  ensureFieldSuffix,
  ensureScalarSuffix,
  getArg,
  hasFlag,
  readFileText,
  isMain,
} from "./aleo-utils.ts";
import { buildNftDataFromMetadataUrl, mintFaucet } from "../ts-sdk/src/modules/index.ts";

function requireNftData(): string {
  const dataArg = getArg("data");
  if (dataArg) return dataArg;

  const dataFileArg = getArg("data-file");
  if (dataFileArg) {
    const fileText = readFileText(dataFileArg);
    if (fileText) return fileText;
  }

  // Fallback: default sample data file in the scripts directory.
  const defaultFile = "mint_private.sample_data.leo";
  const defaultText = readFileText(defaultFile);
  if (defaultText) {
    console.log(`Using default NFT data file: ${defaultFile}`);
    return defaultText;
  }

  throw new Error(
    "Missing --data or --data-file for nft_data, and default file not found.",
  );
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
  const dryRun = hasFlag("dry-run");
  const collectionId = requireCollectionId();
  const edition = ensureScalarSuffix(getArg("edition") || "1");
  const nftData = resolveNftData();
  const client = dryRun ? null : await createClientFromArgs();
  const to =
    getArg("to") || (client ? client.getAddress() : "<recipient-address>");

  console.log("🧪 Minting private NFT via gateway");
  console.log("================================");
  console.log("Gateway: from ts-sdk config");
  console.log(`Collection: ${collectionId}`);
  console.log(`To:      ${to}`);
  console.log(`Edition: ${edition}`);
  const metadataUrl = getArg("metadata-url");
  if (metadataUrl) console.log(`Metadata: ${metadataUrl}`);
  console.log("");

  const inputs = [collectionId, to, nftData, edition];
  if (dryRun) {
    console.log("Dry run only. No transaction sent.");
    console.log(`Inputs: ${JSON.stringify(inputs)}`);
    return;
  }

  const txId = await mintFaucet(client, {
    collectionId,
    to,
    nftData,
    nftEdition: edition,
  });

  console.log("✅ Mint broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
