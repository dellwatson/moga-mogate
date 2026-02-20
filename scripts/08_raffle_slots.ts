#!/usr/bin/env bun
// List available/taken slots for a raffle

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  parseStructFields,
  programNames,
} from "./aleo-utils.ts";

async function main() {
  const raffleIdRaw = getArg("id");
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 2field");
    process.exit(1);
  }
  const raffleId = ensureFieldSuffix(raffleIdRaw);

  const client = createClientFromArgs();

  let totalSlots = Number(getArg("total") || "0");
  if (!totalSlots) {
    const rawState = await client.getProgramMappingValue(
      programNames().rafflePrivate,
      "raffles",
      raffleId,
    );
    const fields = parseStructFields(rawState);
    totalSlots = Number((fields.total_slots || "0u64").replace("u64", ""));
  }

  if (!totalSlots) {
    console.error("Unable to determine total slots. Use --total.");
    process.exit(1);
  }

  const taken: number[] = [];
  const available: number[] = [];

  for (let slot = 1; slot <= totalSlots; slot += 1) {
    const [slotKey] = await client.executeOffline(
      programNames().rafflePrivate,
      "compute_slot_key_hash",
      [raffleId, `${slot}u64`],
    );

    try {
      const value = await client.getProgramMappingValue(
        programNames().rafflePrivate,
        "slot_taken",
        slotKey,
      );
      if (value === "true") {
        taken.push(slot);
      } else {
        available.push(slot);
      }
    } catch {
      available.push(slot);
    }
  }

  console.log("🎯 Slot availability");
  console.log("====================");
  console.log(`Raffle ID:   ${raffleId}`);
  console.log(`Total slots:${totalSlots}`);
  console.log(`Taken:      ${taken.length}`);
  console.log(`Available:  ${available.length}`);
  console.log("");
  console.log(`Taken slots:     ${taken.join(", ") || "(none)"}`);
  console.log(`Available slots: ${available.join(", ") || "(none)"}`);
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
