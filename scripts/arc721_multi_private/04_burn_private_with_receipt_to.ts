#!/usr/bin/env bun
// Burn private NFT and send receipt to a specified address (backend).

import { createClientFromArgs, getArg, isMain } from "../aleo-utils.ts";
import { programNames } from "../aleo-utils.ts";
import { getSetupConfig } from "../setup/setup.config.ts";

const cfg = getSetupConfig();

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
  const receiptOwner = getArg("receipt-owner")
    || getArg("backend")
    || cfg.accounts.backendAddress;

  if (!receiptOwner) {
    throw new Error("Missing --receipt-owner or setup.config.ts accounts.backendAddress");
  }

  const txId = await client.executeBroadcast(
    program,
    "burn_private_with_receipt_to",
    [nftRecord, receiptOwner],
  );

  console.log("✅ Burn (with receipt to backend) broadcasted");
  console.log(`Receipt owner: ${receiptOwner}`);
  console.log(`Transaction:   ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
