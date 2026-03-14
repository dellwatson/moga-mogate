#!/usr/bin/env bun
// Set default raffle duration (blocks) for mogate_darkpool_raffle_privadv.aleo

import { createClientFromArgs, getArg, hasFlag, isMain } from "../aleo-utils.ts";

function resolvePrivateFee(defaultValue: boolean): boolean {
  if (hasFlag("public-fee")) return false;
  if (hasFlag("private-fee")) return true;
  return defaultValue;
}

async function main() {
  const client = await createClientFromArgs();
  const program = getArg("raffle-program")
    || "mogate_darkpool_raffle_privadv.aleo";

  const durationRaw = getArg("duration-blocks") || getArg("duration") || "0";
  const duration = Number(durationRaw);
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error("Invalid --duration-blocks (u64).");
  }

  const privateFee = resolvePrivateFee(false);

  const txId = await client.executeBroadcast(
    program,
    "set_duration_blocks",
    [`${duration}u64`],
    0,
    privateFee,
  );

  console.log("✅ Duration updated");
  console.log(`Program:     ${program}`);
  console.log(`Duration:    ${duration}u64 blocks`);
  console.log(`Fee:         ${privateFee ? "private" : "public"}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
