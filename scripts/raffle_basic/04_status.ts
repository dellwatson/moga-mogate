#!/usr/bin/env bun
// Fetch raffle status and public fields

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  isMain,
  programNames,
} from "../aleo-utils.ts";
import { getRaffleDetail } from "../../ts-sdk/src/modules/index.ts";

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args.
const INPUT = {
  raffleProgram: "",
  raffleId: "001",
};

function pickString(value?: string, fallback?: string): string | undefined {
  const first = value && value.trim().length ? value : undefined;
  if (first) return first;
  const second = fallback && fallback.trim().length ? fallback : undefined;
  if (second) return second;
  return undefined;
}

async function main() {
  const raffleIdRaw = pickString(INPUT.raffleId, getArg("id"));
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 2field");
    process.exit(1);
  }
  const raffleId = ensureFieldSuffix(raffleIdRaw);
  const raffleProgram = pickString(
    INPUT.raffleProgram,
    getArg("raffle-program"),
  );

  const client = await createClientFromArgs();
  const detail = await getRaffleDetail(
    client,
    raffleId,
    raffleProgram ? { rafflePrivate: raffleProgram } : undefined,
  );
  const { raw, fields } = detail;

  console.log("📦 Raffle state");
  console.log("===============");
  console.log(`Program:  ${raffleProgram || programNames().rafflePrivate}`);
  console.log(`Raffle ID: ${raffleId}`);
  console.log(`Raw:       ${raw}`);
  if (Object.keys(fields).length) {
    console.log("");
    console.log(`Organizer:  ${fields.organizer || ""}`);
    console.log(`Treasury:   ${fields.treasury || ""}`);
    console.log(
      `Slots:      ${fields.sold_slots || ""} / ${fields.total_slots || ""}`,
    );
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
