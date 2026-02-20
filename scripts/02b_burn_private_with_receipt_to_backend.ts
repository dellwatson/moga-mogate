#!/usr/bin/env bun
// Burn private NFT and create receipt for a backend address

import { createClientFromArgs, getArg, programNames } from "./aleo-utils.ts";

async function main() {
  const nftRecord = process.argv[2];
  if (!nftRecord) {
    console.error("Usage: bun scripts/02b_burn_private_with_receipt_to_backend.ts '<NFT_RECORD>' --backend <ALEO_ADDRESS>");
    process.exit(1);
  }

  const backend = getArg("backend") || process.env.BACKEND_ADDRESS;
  if (!backend) {
    console.error("Missing backend address. Use --backend or set BACKEND_ADDRESS.");
    process.exit(1);
  }

  const client = createClientFromArgs();
  console.log("🔥 Burning private NFT (receipt to backend)");
  console.log("==========================================");
  console.log(`Account:  ${client.getAddress()}`);
  console.log(`Backend:  ${backend}`);
  console.log("");

  const txId = await client.executeBroadcast(
    programNames().arc721Private,
    "burn_private_with_receipt_to",
    [nftRecord, backend],
  );

  console.log("✅ Burn broadcasted");
  console.log(`Transaction: ${txId}`);
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
