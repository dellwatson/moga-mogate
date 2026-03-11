#!/usr/bin/env bun
// Mint private NFT via authority mint gateway (v4, multi-collection)

import {
  createClientFromArgs,
  ensureFieldSuffix,
  ensureScalarSuffix,
  getArg,
  hasFlag,
  readFileText,
  isMain,
} from "../aleo-utils.ts";
import { buildNftDataFromMetadataUrl, mintFaucet } from "../../ts-sdk/src/modules/index.ts";
import { getSetupConfig } from "../setup/setup.config.ts";

const cfg = getSetupConfig();
const DEFAULTS = {
  collectionId: cfg.collectionDefaults.collectionId,
  metadataUrl: cfg.collectionDefaults.metadataUrl,
  edition: "1",
};

function requireNftData(): string {
  const dataArg = getArg("data");
  if (dataArg) return dataArg;

  const dataFileArg = getArg("data-file");
  if (dataFileArg) {
    const fileText = readFileText(dataFileArg);
    if (fileText) return fileText;
  }

  const metadataUrl = getArg("metadata-url") || DEFAULTS.metadataUrl;
  if (metadataUrl) {
    return buildNftDataFromMetadataUrl(metadataUrl);
  }

  throw new Error("Missing --data/--data-file or --metadata-url.");
}

async function main() {
  const client = await createClientFromArgs();
  const collectionId = ensureFieldSuffix(
    getArg("collection") || getArg("collection-id") || DEFAULTS.collectionId,
  );
  const to = getArg("to") || client.getAddress();
  const edition = ensureScalarSuffix(getArg("edition") || DEFAULTS.edition);
  const nftData = requireNftData();
  const privateFee = hasFlag("private-fee");

  const txId = await mintFaucet(client, {
    collectionId,
    to,
    nftData,
    nftEdition: edition,
    privateFee,
  });

  console.log("✅ Gateway mint broadcasted");
  console.log(`Collection: ${collectionId}`);
  console.log(`To:         ${to}`);
  console.log(`Edition:    ${edition}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
