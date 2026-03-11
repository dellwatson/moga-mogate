#!/usr/bin/env bun
// Claim raffle prize using winning ticket

import {
  createClientFromArgs,
  ensureScalarSuffix,
  getArg,
  readFileText,
  isMain,
} from "./aleo-utils.ts";
import { buildNftDataFromMetadataUrl, claimRafflePrize } from "../ts-sdk/src/modules/index.ts";

function requireNftData(): string {
  const dataArg = getArg("data");
  if (dataArg) return dataArg;
  const dataFile = getArg("data-file");
  const fileText = readFileText(dataFile);
  if (fileText) return fileText;
  throw new Error("Missing --data or --data-file for nft_data.");
}

function resolveNftData(): string {
  const metadataUrl = getArg("metadata-url");
  if (metadataUrl) {
    return buildNftDataFromMetadataUrl(metadataUrl);
  }
  return requireNftData();
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

  const collectionRaw = getArg("collection") || getArg("collection-id");
  if (!collectionRaw) {
    console.error("Missing --collection <field> for prize collection_id.");
    process.exit(1);
  }

  const nftData = resolveNftData();
  const nftEdition = ensureScalarSuffix(getArg("edition") || "1");

  const client = await createClientFromArgs();
  const txId = await claimRafflePrize(client, {
    ticketRecord,
    slotId,
    collectionId: collectionRaw,
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
