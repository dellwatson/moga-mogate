#!/usr/bin/env bun
// List available/taken slots for a raffle

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  hasFlag,
  isMain,
  programNames,
} from "../aleo-utils.ts";
import { getRaffleSlots } from "../../ts-sdk/src/modules/index.ts";

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args.
const INPUT = {
  raffleProgram: "",
  raffleId: "001",
  mode: "taken", // "taken" | "available" | "both"
  json: undefined as boolean | undefined,
  concurrency: "24",
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
  const totalSlots = pickNumber(getArg("total"), undefined) || 0;
  const concurrency =
    pickNumber(INPUT.concurrency, getArg("concurrency")) || 24;
  const startedAt = Date.now();
  const slots = await getRaffleSlots(
    client,
    raffleId,
    totalSlots || undefined,
    raffleProgram ? { rafflePrivate: raffleProgram } : undefined,
    concurrency,
  );
  const elapsedMs = Date.now() - startedAt;

  const modeRaw = (
    pickString(INPUT.mode, getArg("mode")) || "both"
  ).toLowerCase();
  const mode =
    modeRaw === "taken" || modeRaw === "available" ? modeRaw : "both";
  const json = typeof INPUT.json === "boolean" ? INPUT.json : hasFlag("json");

  const out = mode === "taken"
    ? {
        taken: slots.taken,
        totalSlots: slots.totalSlots,
        source: slots.source,
        elapsedMs,
      }
    : mode === "available"
    ? {
        available: slots.available,
        totalSlots: slots.totalSlots,
        source: slots.source,
        elapsedMs,
      }
    : {
        taken: slots.taken,
        available: slots.available,
        totalSlots: slots.totalSlots,
        source: slots.source,
        elapsedMs,
      };

  if (json) {
    console.log(JSON.stringify(out));
    return;
  }

  console.log("🎯 Array-slot");
  console.log("================================");
  console.log(`Program:      ${raffleProgram || programNames().rafflePrivate}`);
  console.log(`Raffle ID:     ${raffleId}`);
  console.log(`Total slots:   ${slots.totalSlots}`);
  console.log(`Source:       ${slots.source}`);
  console.log(`Concurrency:   ${concurrency}`);
  console.log(`Time:          ${elapsedMs} ms`);
  console.log(`Mode:          ${mode}`);
  console.log(`Taken:         ${slots.taken.length}`);
  console.log(`Available:     ${slots.available.length}`);
  console.log("");
  if (mode === "taken" || mode === "both") {
    console.log(`Taken slots:     ${slots.taken.join(", ") || "(none)"}`);
  }
  if (mode === "available" || mode === "both") {
    console.log(`Available slots: ${slots.available.join(", ") || "(none)"}`);
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
