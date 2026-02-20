#!/usr/bin/env bun
// Mint private NFT via authority mint gateway

import {
  createClientFromArgs,
  ensureScalarSuffix,
  getArg,
  programNames,
  readFileText,
} from "./aleo-utils.ts";

function requireNftData(): string {
  const dataArg = getArg("data");
  if (dataArg) return dataArg;
  const dataFile = getArg("data-file");
  const fileText = readFileText(dataFile);
  if (fileText) return fileText;
  throw new Error("Missing --data or --data-file for nft_data.");
}

async function main() {
  const client = createClientFromArgs();
  const to = getArg("to") || client.getAddress();
  const edition = ensureScalarSuffix(getArg("edition") || "1");
  const nftData = requireNftData();

  console.log("🧪 Minting private NFT via gateway");
  console.log("================================");
  console.log(`Gateway: ${programNames().gateway}`);
  console.log(`To:      ${to}`);
  console.log(`Edition: ${edition}`);
  console.log("");

  const inputs = [to, nftData, edition];
  const txId = await client.executeBroadcast(
    programNames().gateway,
    "mint_private",
    inputs,
  );

  console.log("✅ Mint broadcasted");
  console.log(`Transaction: ${txId}`);
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
