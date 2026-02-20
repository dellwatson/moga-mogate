#!/usr/bin/env bun
// Claim raffle prize using winning ticket

import {
  createClientFromArgs,
  ensureScalarSuffix,
  getArg,
  readFileText,
  isMain,
} from "./aleo-utils.ts";
import { claimRafflePrize } from "../ts-sdk/src/modules/index.ts";

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

  const client = await createClientFromArgs();
  const txId = await claimRafflePrize(client, {
    ticketRecord,
    slotId,
    nftData,
    nftEdition,
  });

  console.log("✅ Claim broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
