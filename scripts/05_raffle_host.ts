#!/usr/bin/env bun
// Host a private darkpool raffle (unsafe)

import {
  createClientFromArgs,
  ensureFieldSuffix,
  ensureScalarSuffix,
  getArg,
  hasFlag,
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

  const [seedCommit] = await client.executeOffline(
    programNames().rafflePrivate,
    "compute_seed_commit",
    [raffleId, `${seed}u64`],
  );

  const [prizeCommit] = await client.executeOffline(
    programNames().arc721Private,
    "compute_nft_commit",
    [nftData, nftEdition],
  );

  console.log("🎟️  Hosting raffle (unsafe)");
  console.log("============================");
  console.log(`Program:      ${programNames().rafflePrivate}`);
  console.log(`Raffle ID:    ${raffleId}`);
  console.log(`Total slots:  ${totalSlots}`);
  console.log(`Max per user: ${maxSlots}`);
  console.log(`Metadata:     ${metadataHash}`);
  console.log(`Seed:         ${seed}u64`);
  console.log(`Seed commit:  ${seedCommit}`);
  console.log(`Prize commit: ${prizeCommit}`);
  console.log(`Auto draw:    ${autoDraw}`);
  console.log(`Auto claim:   ${autoClaim}`);
  console.log("");

  const inputs = [
    raffleId,
    `${totalSlots}u64`,
    `${maxSlots}u64`,
    metadataHash,
    prizeCommit,
    seedCommit,
    autoDraw ? "true" : "false",
    autoClaim ? "true" : "false",
  ];

  const txId = await client.executeBroadcast(
    programNames().rafflePrivate,
    "unsafe_host_raffle",
    inputs,
  );

  console.log("✅ Host broadcasted");
  console.log(`Transaction: ${txId}`);
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
