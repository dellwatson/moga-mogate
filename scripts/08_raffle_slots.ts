#!/usr/bin/env bun
// List available/taken slots for a raffle

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  isMain,
} from "./aleo-utils.ts";
import { getRaffleSlots } from "../ts-sdk/src/modules/index.ts";

async function main() {
  const raffleIdRaw = getArg("id");
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 2field");
    process.exit(1);
  }
  const raffleId = ensureFieldSuffix(raffleIdRaw);

  const client = await createClientFromArgs();
  const totalSlots = Number(getArg("total") || "0");
  const slots = await getRaffleSlots(client, raffleId, totalSlots || undefined);

  console.log("🎯 Slot availability");
  console.log("====================");
  console.log(`Raffle ID:   ${raffleId}`);
  console.log(`Total slots:${slots.totalSlots}`);
  console.log(`Taken:      ${slots.taken.length}`);
  console.log(`Available:  ${slots.available.length}`);
  console.log("");
  console.log(`Taken slots:     ${slots.taken.join(", ") || "(none)"}`);
  console.log(`Available slots: ${slots.available.join(", ") || "(none)"}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
