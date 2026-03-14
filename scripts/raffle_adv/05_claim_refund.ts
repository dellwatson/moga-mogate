#!/usr/bin/env bun
// Claim refund (adv program) using a TicketBatch record.
// This script parses `paid` + `raffle_id` from the record and computes refund_amount.

import { createClientFromArgs, getArg, hasFlag, isMain } from "../aleo-utils.ts";
import { parseStructFields } from "../../ts-sdk/src/modules/index.ts";

function resolvePrivateFee(defaultValue: boolean): boolean {
  if (hasFlag("public-fee")) return false;
  if (hasFlag("private-fee")) return true;
  return defaultValue;
}

async function main() {
  const ticketRecord = process.argv[2];
  if (!ticketRecord) {
    console.error(
      "Usage: bun scripts/raffle_adv/05_claim_refund.ts '<TICKET_RECORD>'",
    );
    process.exit(1);
  }

  const client = await createClientFromArgs();
  const program = getArg("raffle-program")
    || "mogate_darkpool_raffle_privadv.aleo";
  const privateFee = resolvePrivateFee(true);

  const ticketFields = parseStructFields(ticketRecord);
  const raffleId = ticketFields.raffle_id;
  const paidRaw = ticketFields.paid;
  if (!raffleId) throw new Error("Unable to parse raffle_id from TicketBatch record.");
  if (!paidRaw) throw new Error("Unable to parse paid from TicketBatch record.");

  const paid = Number(paidRaw.replace("u64", ""));
  if (!Number.isFinite(paid) || paid <= 0) {
    throw new Error(`Invalid paid amount in TicketBatch record: ${paidRaw}`);
  }

  const raffleRaw = await client.getProgramMappingValue(program, "raffles", raffleId);
  const raffleFields = parseStructFields(raffleRaw);
  const refundBpsRaw = raffleFields.refund_bps || "0u64";
  const refundBps = Number(refundBpsRaw.replace("u64", ""));
  const refundAmount = Math.floor((paid * refundBps) / 10_000);
  if (refundAmount <= 0) {
    throw new Error(
      `Computed refundAmount is 0. paid=${paid} refund_bps=${refundBpsRaw}`,
    );
  }

  const txId = await client.executeBroadcast(
    program,
    "claim_refund",
    [ticketRecord, `${paid}u64`, `${refundAmount}u64`],
    0,
    privateFee,
  );

  console.log("✅ Refund claim broadcasted");
  console.log(`Program:     ${program}`);
  console.log(`Raffle ID:   ${raffleId}`);
  console.log(`Paid:        ${paid}u64`);
  console.log(`Refund:      ${refundAmount}u64`);
  console.log(`Fee:         ${privateFee ? "private" : "public"}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
