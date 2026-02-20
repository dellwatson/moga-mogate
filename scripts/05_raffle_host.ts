#!/usr/bin/env bun
// Host a private darkpool raffle (unsafe)

import {
  createClientFromArgs,
  ensureFieldSuffix,
  ensureScalarSuffix,
  getArg,
  hasFlag,
  readFileText,
  isMain,
} from "./aleo-utils.ts";
import { hostRaffleUnsafe } from "../ts-sdk/src/modules/index.ts";

function requireNftData(): string {
  const dataArg = getArg("data");
  if (dataArg) return dataArg;
  const dataFile = getArg("data-file");
  const fileText = readFileText(dataFile);
  if (fileText) return fileText;
  throw new Error("Missing --data or --data-file for nft_data.");
}

async function main() {
  const client = await createClientFromArgs();

  const raffleIdRaw = getArg("id");
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 1field");
    process.exit(1);
  }

  const raffleId = ensureFieldSuffix(raffleIdRaw);
  const totalSlots = Number(getArg("total") || "200");
  const maxSlots = Number(getArg("max-per") || "0");
  const metadataHash = ensureFieldSuffix(getArg("metadata") || "0field");
  const seed = Number(getArg("seed") || "42");
  const autoDraw = hasFlag("auto-draw");
  const autoClaim = hasFlag("auto-claim");

  const nftEdition = ensureScalarSuffix(getArg("edition") || "1");
  const nftData = requireNftData();

  const result = await hostRaffleUnsafe(client, {
    raffleId,
    totalSlots,
    maxSlotsPerAddress: maxSlots,
    metadataHash,
    seed,
    nftData,
    nftEdition,
    autoDraw,
    autoClaim,
  });

  console.log("🎟️  Hosting raffle (unsafe)");
  console.log("============================");
  console.log("Program:      from ts-sdk config");
  console.log(`Raffle ID:    ${raffleId}`);
  console.log(`Total slots:  ${totalSlots}`);
  console.log(`Max per user: ${maxSlots}`);
  console.log(`Metadata:     ${metadataHash}`);
  console.log(`Seed:         ${seed}u64`);
  console.log(`Seed commit:  ${result.seedCommit}`);
  console.log(`Prize commit: ${result.prizeCommit}`);
  console.log(`Auto draw:    ${autoDraw}`);
  console.log(`Auto claim:   ${autoClaim}`);
  console.log("");

  console.log("✅ Host broadcasted");
  console.log(`Transaction: ${result.txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
