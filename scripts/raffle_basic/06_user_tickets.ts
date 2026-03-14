#!/usr/bin/env bun
// List raffle tickets (TicketBatch records) for current account

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  isMain,
  programNames,
} from "../aleo-utils.ts";
import { getUserTickets } from "../../ts-sdk/src/modules/index.ts";

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args.
const INPUT = {
  raffleProgram: "",
  raffleId: "001",
  maxRecords: "5",
};

function pickString(value?: string, fallback?: string): string | undefined {
  const first = value && value.trim().length ? value : undefined;
  if (first) return first;
  const second = fallback && fallback.trim().length ? fallback : undefined;
  if (second) return second;
  return undefined;
}

function pickNumber(value?: string, fallback?: string): number | undefined {
  const raw = pickString(value, fallback);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const client = await createClientFromArgs();
  const filterRaffleRaw = pickString(INPUT.raffleId, getArg("raffle"));
  const filterRaffle = filterRaffleRaw ? ensureFieldSuffix(filterRaffleRaw) : undefined;
  const raffleProgram = pickString(
    INPUT.raffleProgram,
    getArg("raffle-program"),
  );
  const maxRecords = pickNumber(INPUT.maxRecords, getArg("max")) || 50;

  const result = await getUserTickets(client, {
    raffleId: filterRaffle,
    maxRecords,
    programs: raffleProgram ? { rafflePrivate: raffleProgram } : undefined,
  });

  if (!result.tickets.length) {
    console.log("No TicketBatch records found.");
    return;
  }

  result.tickets.forEach((ticket, idx) => {
    console.log(`[#${idx + 1}] ${ticket.raw}`);
    if (ticket.raffleId) console.log(`  raffle_id: ${ticket.raffleId}`);
    if (ticket.slots.length)
      console.log(`  slots:     [${ticket.slots.join(", ")}]`);
  });

  console.log("");
  console.log(`Program: ${raffleProgram || programNames().rafflePrivate}`);
  console.log("Raffle IDs:");
  console.log(result.raffleIds.join(", ") || "(none)");
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
