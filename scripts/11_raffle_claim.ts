#!/usr/bin/env bun
// Claim raffle prize using winning ticket

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
  const ticketRecord = process.argv[2];
  if (!ticketRecord) {
    console.error("Usage: bun scripts/11_raffle_claim.ts '<TICKET_RECORD>' --slot <u64>");
    process.exit(1);
  }

  const slotRaw = getArg("slot");
  if (!slotRaw) {
    console.error("Missing --slot <u64>");
    process.exit(1);
  }
  const slotId = Number(slotRaw);

  const nftData = requireNftData();
  const nftEdition = ensureScalarSuffix(getArg("edition") || "1");

  const client = createClientFromArgs();
  const txId = await client.executeBroadcast(
    programNames().rafflePrivate,
    "claim_prize",
    [ticketRecord, `${slotId}u64`, nftData, nftEdition],
  );

  console.log("✅ Claim broadcasted");
  console.log(`Transaction: ${txId}`);
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
