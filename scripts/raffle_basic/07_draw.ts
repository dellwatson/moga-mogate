#!/usr/bin/env bun
// Draw raffle winner

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  hasFlag,
  isMain,
  programNames,
} from "../aleo-utils.ts";
import { drawRaffle } from "../../ts-sdk/src/modules/index.ts";

function resolvePrivateFee(defaultValue: boolean): boolean {
  if (hasFlag("public-fee")) return false;
  if (hasFlag("private-fee")) return true;
  return defaultValue;
}

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args.
const INPUT = {
  raffleProgram: "",
  raffleId: "",
  seed: "",
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
  const raffleIdRaw = pickString(INPUT.raffleId, getArg("id"));
  const seedRaw = pickString(INPUT.seed, getArg("seed"));
  if (!raffleIdRaw || !seedRaw) {
    console.error("Usage: --id <field> --seed <u64>");
    process.exit(1);
  }

  const raffleId = ensureFieldSuffix(raffleIdRaw);
  const seed = Number(seedRaw);
  const raffleProgram = pickString(INPUT.raffleProgram, getArg("raffle-program"));
  const privateFee = typeof INPUT.privateFee === "boolean"
    ? INPUT.privateFee
    : resolvePrivateFee(false);

  const client = await createClientFromArgs();
  const txId = await drawRaffle(client, {
    raffleId,
    seed,
    programs: raffleProgram ? { rafflePrivate: raffleProgram } : undefined,
    privateFee,
  });

  console.log("✅ Draw broadcasted");
  console.log(`Program: ${raffleProgram || programNames().rafflePrivate}`);
  console.log(`Fee: ${privateFee ? "private" : "public"}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
