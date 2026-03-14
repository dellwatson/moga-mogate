#!/usr/bin/env bun
// Cancel a raffle after deadline (adv program).
// This script computes keep/refund amounts from on-chain raffle state.

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  hasFlag,
  isMain,
} from "../aleo-utils.ts";
import { parseStructFields } from "../../ts-sdk/src/modules/index.ts";

function resolvePrivateFee(defaultValue: boolean): boolean {
  if (hasFlag("public-fee")) return false;
  if (hasFlag("private-fee")) return true;
  return defaultValue;
}

async function main() {
  const raffleIdRaw = getArg("id");
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 2field");
    process.exit(1);
  }
  const raffleId = ensureFieldSuffix(raffleIdRaw);

  const client = await createClientFromArgs();
  const program = getArg("raffle-program")
    || "mogate_darkpool_raffle_privadv.aleo";
  const privateFee = resolvePrivateFee(false);

  const raw = await client.getProgramMappingValue(program, "raffles", raffleId);
  const fields = parseStructFields(raw);
  const totalCollected = Number((fields.total_collected || "0u64").replace("u64", ""));
  const refundBps = Number((fields.refund_bps || "0u64").replace("u64", ""));
  const feeRecipient = fields.fee_recipient;

  if (!feeRecipient) {
    throw new Error("Unable to resolve fee_recipient from on-chain raffle state.");
  }

  const refundPool = Math.floor((totalCollected * refundBps) / 10_000);
  const keepAmount = totalCollected - refundPool;

  const txId = await client.executeBroadcast(
    program,
    "cancel_raffle",
    [raffleId, feeRecipient, `${keepAmount}u64`, `${refundPool}u64`],
    0,
    privateFee,
  );

  console.log("✅ Cancel broadcasted");
  console.log(`Program:     ${program}`);
  console.log(`Raffle ID:   ${raffleId}`);
  console.log(`Keep amount: ${keepAmount}u64`);
  console.log(`Refund pool: ${refundPool}u64`);
  console.log(`Fee:         ${privateFee ? "private" : "public"}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
