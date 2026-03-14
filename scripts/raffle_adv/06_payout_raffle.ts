#!/usr/bin/env bun
// Payout a DRAWN raffle pot (adv program).
// This script computes host_amount + fee_amount from on-chain raffle state.

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

  const host = fields.organizer;
  const feeRecipient = fields.fee_recipient;
  const totalCollected = Number((fields.total_collected || "0u64").replace("u64", ""));
  const feeBps = Number((fields.fee_bps || "0u64").replace("u64", ""));

  if (!host) throw new Error("Unable to resolve organizer (host) from on-chain raffle state.");
  if (!feeRecipient) throw new Error("Unable to resolve fee_recipient from on-chain raffle state.");

  const feeAmount = Math.floor((totalCollected * feeBps) / 10_000);
  const hostAmount = totalCollected - feeAmount;

  const txId = await client.executeBroadcast(
    program,
    "payout_raffle",
    [raffleId, host, feeRecipient, `${hostAmount}u64`, `${feeAmount}u64`],
    0,
    privateFee,
  );

  console.log("✅ Payout broadcasted");
  console.log(`Program:      ${program}`);
  console.log(`Raffle ID:    ${raffleId}`);
  console.log(`Host:         ${host}`);
  console.log(`Fee recipient:${feeRecipient}`);
  console.log(`Host amount:  ${hostAmount}u64`);
  console.log(`Fee amount:   ${feeAmount}u64`);
  console.log(`Fee:          ${privateFee ? "private" : "public"}`);
  console.log(`Transaction:  ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
