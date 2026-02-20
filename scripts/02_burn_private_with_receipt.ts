#!/usr/bin/env bun
// Burn private NFT and receive a burn receipt (owned by caller)

import { createClientFromArgs, isMain, programNames } from "./aleo-utils.ts";

async function main() {
  const nftRecord = process.argv[2];
  if (!nftRecord) {
    console.error("Usage: bun scripts/02_burn_private_with_receipt.ts '<NFT_RECORD>'");
    process.exit(1);
  }

  const client = await createClientFromArgs();
  console.log("🔥 Burning private NFT (receipt to owner)");
  console.log("========================================");
  console.log(`Account:  ${client.getAddress()}`);
  console.log("");

  const txId = await client.executeBroadcast(
    programNames().arc721Private,
    "burn_private_with_receipt",
    [nftRecord],
  );

  console.log("✅ Burn broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
