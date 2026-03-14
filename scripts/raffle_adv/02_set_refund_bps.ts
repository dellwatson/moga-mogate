#!/usr/bin/env bun
// Set refund bps for mogate_darkpool_raffle_privadv.aleo

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

  const refundBps = Number(getArg("refund-bps") || "8000");
  if (!Number.isFinite(refundBps) || refundBps < 0 || refundBps > 10_000) {
    throw new Error("Invalid --refund-bps (0..10000).");
  }

  const privateFee = resolvePrivateFee(false);

  const txId = await client.executeBroadcast(
    program,
    "set_refund_bps",
    [`${refundBps}u64`],
    0,
    privateFee,
  );

  console.log("✅ Refund bps updated");
  console.log(`Program:     ${program}`);
  console.log(`Refund bps:  ${refundBps}u64`);
  console.log(`Fee:         ${privateFee ? "private" : "public"}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
