#!/usr/bin/env bun
// Set fee config for mogate_darkpool_raffle_privadv.aleo

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

  const feeBps = Number(getArg("fee-bps") || "1000");
  if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new Error("Invalid --fee-bps (0..10000).");
  }

  const feeRecipient = getArg("fee-recipient") || getArg("recipient") || client.getAddress();
  const privateFee = resolvePrivateFee(false);

  const txId = await client.executeBroadcast(
    program,
    "set_fee_config",
    [`${feeBps}u64`, feeRecipient],
    0,
    privateFee,
  );

  console.log("✅ Fee config updated");
  console.log(`Program:      ${program}`);
  console.log(`Fee bps:      ${feeBps}u64`);
  console.log(`Fee recipient:${feeRecipient}`);
  console.log(`Fee:          ${privateFee ? "private" : "public"}`);
  console.log(`Transaction:  ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
