#!/usr/bin/env bun
// List raffle tickets (TicketBatch records) for current account

import { createClientFromArgs, getArg, programNames } from "./aleo-utils.ts";

function extractField(raw: string, key: string): string | undefined {
  const regex = new RegExp(`${key}\\s*:\\s*([^,}]+)`);
  const match = raw.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractSlots(raw: string): string | undefined {
  const match = raw.match(/slots\s*:\s*\[([^\]]+)\]/);
  return match ? match[1].trim() : undefined;
}

async function main() {
  const client = createClientFromArgs();
  const programName = programNames().rafflePrivate;
  const recordName = "TicketBatch";
  const filterRaffle = getArg("raffle");

  const records = await client.findRecords(programName, recordName, 50, 0);
  if (!records.length) {
    console.log("No TicketBatch records found.");
    return;
  }

  const raffleIds = new Set<string>();

  records.forEach((record: any, idx: number) => {
    const text = typeof record?.toString === "function" ? record.toString() : String(record);
    const raffleId = extractField(text, "raffle_id");
    if (raffleId) raffleIds.add(raffleId);

    if (!filterRaffle || filterRaffle === raffleId) {
      const slots = extractSlots(text);
      console.log(`[#${idx + 1}] ${text}`);
      if (raffleId) console.log(`  raffle_id: ${raffleId}`);
      if (slots) console.log(`  slots:     [${slots}]`);
    }
  });

  console.log("");
  console.log("Raffle IDs:");
  console.log([...raffleIds].join(", ") || "(none)");
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
