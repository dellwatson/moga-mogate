#!/usr/bin/env bun
// Initialize private darkpool raffle program

import { createClientFromArgs, getArg, hasFlag, isMain, programNames } from "../aleo-utils.ts";
import { initializeRafflePrivate } from "../../ts-sdk/src/modules/index.ts";

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args, then defaults.
const INPUT = {
  raffleProgram: "",
  admin: "",
  backend: "",
  treasury: "",
  privateFee: undefined as boolean | undefined,
};

function pickString(value?: string, fallback?: string): string | undefined {
  const first = value && value.trim().length ? value : undefined;
  if (first) return first;
  const second = fallback && fallback.trim().length ? fallback : undefined;
  if (second) return second;
  return undefined;
}

async function main() {
  const client = await createClientFromArgs();
  const admin = pickString(INPUT.admin, getArg("admin")) || client.getAddress();
  const backend = pickString(INPUT.backend, getArg("backend")) || admin;
  const treasury = pickString(INPUT.treasury, getArg("treasury")) || admin;
  const privateFee = typeof INPUT.privateFee === "boolean"
    ? INPUT.privateFee
    : (hasFlag("private-fee") && !hasFlag("public-fee"));
  const raffleProgram = pickString(INPUT.raffleProgram, getArg("raffle-program"));

  console.log("⚙️  Initializing raffle program");
  console.log("================================");
  console.log(`Program:  ${raffleProgram || programNames().rafflePrivate}`);
  console.log(`Admin:    ${admin}`);
  console.log(`Backend:  ${backend}`);
  console.log(`Treasury: ${treasury}`);
  console.log(`Fee:      ${privateFee ? "private" : "public"}`);
  console.log("");

  const txId = await initializeRafflePrivate(client, {
    admin,
    backend,
    treasury,
    programs: raffleProgram ? { rafflePrivate: raffleProgram } : undefined,
    privateFee,
  });

  console.log("✅ Initialize broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
