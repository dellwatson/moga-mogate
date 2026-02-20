#!/usr/bin/env bun
// Fetch raffle status and public fields

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  isMain,
} from "./aleo-utils.ts";
import { getRaffleDetail } from "../ts-sdk/src/modules/index.ts";

async function main() {
  const raffleIdRaw = getArg("id");
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 2field");
    process.exit(1);
  }
  const raffleId = ensureFieldSuffix(raffleIdRaw);

  const client = await createClientFromArgs();
  const detail = await getRaffleDetail(client, raffleId);
  const { raw, fields } = detail;
  console.log("📦 Raffle state");
  console.log("===============");
  console.log(`Raffle ID: ${raffleId}`);
  console.log(`Raw:       ${raw}`);
  if (Object.keys(fields).length) {
    console.log("");
    console.log(`Organizer:  ${fields.organizer || ""}`);
    console.log(`Slots:      ${fields.sold_slots || ""} / ${fields.total_slots || ""}`);
    console.log(`Winner:     ${fields.winner_slot || ""}`);
    console.log(`Status:     ${fields.status || ""} (${detail.status})`);
    console.log(`Auto draw:  ${fields.auto_draw || ""}`);
    console.log(`Auto claim: ${fields.auto_claim || ""}`);
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
