#!/usr/bin/env bun
// List raffle tickets (TicketBatch records) for current account

import { createClientFromArgs, getArg, isMain } from "./aleo-utils.ts";
import { getUserTickets } from "../ts-sdk/src/modules/index.ts";

async function main() {
  const client = await createClientFromArgs();
  const filterRaffle = getArg("raffle");

  const result = await getUserTickets(client, {
    raffleId: filterRaffle,
    maxRecords: 50,
    startHeight: 0,
  });

  if (!result.tickets.length) {
    console.log("No TicketBatch records found.");
    return;
  }

  result.tickets.forEach((ticket, idx) => {
    console.log(`[#${idx + 1}] ${ticket.raw}`);
    if (ticket.raffleId) console.log(`  raffle_id: ${ticket.raffleId}`);
    if (ticket.slots.length) console.log(`  slots:     [${ticket.slots.join(", ")}]`);
  });

  console.log("");
  console.log("Raffle IDs:");
  console.log(result.raffleIds.join(", ") || "(none)");
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
