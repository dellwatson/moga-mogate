#!/usr/bin/env bun
// Fetch raffle status and public fields

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  parseStructFields,
  programNames,
} from "./aleo-utils.ts";

function statusLabel(status: string | undefined): string {
  switch (status) {
    case "0u8":
      return "OPEN";
    case "1u8":
      return "FILLED";
    case "2u8":
      return "DRAWN";
    case "3u8":
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}

async function main() {
  const raffleIdRaw = getArg("id");
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 2field");
    process.exit(1);
  }
  const raffleId = ensureFieldSuffix(raffleIdRaw);

  const client = createClientFromArgs();
  const raw = await client.getProgramMappingValue(
    programNames().rafflePrivate,
    "raffles",
    raffleId,
  );

  const fields = parseStructFields(raw);
  console.log("📦 Raffle state");
  console.log("===============");
  console.log(`Raffle ID: ${raffleId}`);
  console.log(`Raw:       ${raw}`);
  if (Object.keys(fields).length) {
    console.log("");
    console.log(`Organizer:  ${fields.organizer || ""}`);
    console.log(`Slots:      ${fields.sold_slots || ""} / ${fields.total_slots || ""}`);
    console.log(`Winner:     ${fields.winner_slot || ""}`);
    console.log(`Status:     ${fields.status || ""} (${statusLabel(fields.status)})`);
    console.log(`Auto draw:  ${fields.auto_draw || ""}`);
    console.log(`Auto claim: ${fields.auto_claim || ""}`);
  }
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
