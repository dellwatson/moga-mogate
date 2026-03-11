#!/usr/bin/env bun
// Burn private NFT and return receipt owned by caller.

import { createClientFromArgs, getArg, isMain } from "../aleo-utils.ts";
import { programNames } from "../aleo-utils.ts";

function requireRecord(): string {
  const direct = getArg("nft") || getArg("record") || process.argv[2];
  if (!direct) {
    throw new Error("Missing NFT record. Use --nft '<record>' or pass as first arg.");
  }
  return direct;
}

async function main() {
  const client = await createClientFromArgs();
  const program = getArg("program") || programNames().arc721Private;
  const nftRecord = requireRecord();

  const txId = await client.executeBroadcast(
    program,
    "burn_private_with_receipt",
    [nftRecord],
  );

  console.log("✅ Burn (with receipt) broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
