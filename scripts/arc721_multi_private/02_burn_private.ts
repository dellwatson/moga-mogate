#!/usr/bin/env bun
// Burn private NFT from mogate_arc721_multiprivate.aleo

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
    "burn_private",
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
