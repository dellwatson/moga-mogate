#!/usr/bin/env bun
// Mint private NFT through gateway faucet flow (public mint_private)

import {
  createClientFromArgs,
  ensureScalarSuffix,
  getArg,
  readFileText,
  isMain,
} from "./aleo-utils.ts";
import { mintFaucet } from "../ts-sdk/src/modules/index.ts";

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

async function main() {
  const edition = ensureScalarSuffix(getArg("edition") || "1");
  const nftData = requireNftData();
  const client = await createClientFromArgs();
  const to = getArg("to") || client.getAddress();

  console.log("🎁 Minting NFT through faucet flow");
  console.log("=================================");
  console.log(`To:      ${to}`);
  console.log(`Edition: ${edition}`);
  console.log("");

  const txId = await mintFaucet(client, {
    to,
    nftData,
    nftEdition: edition,
  });

  console.log("✅ Faucet mint broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
