#!/usr/bin/env bun
// Draw raffle winner

import { createClientFromArgs, ensureFieldSuffix, getArg, isMain } from "./aleo-utils.ts";
import { drawRaffle } from "../ts-sdk/src/modules/index.ts";

async function main() {
  const raffleIdRaw = getArg("id");
  const seedRaw = getArg("seed");
  if (!raffleIdRaw || !seedRaw) {
    console.error("Usage: --id <field> --seed <u64>");
    process.exit(1);
  }

  const raffleId = ensureFieldSuffix(raffleIdRaw);
  const seed = Number(seedRaw);

  const client = await createClientFromArgs();
  const txId = await drawRaffle(client, { raffleId, seed });

  console.log("✅ Draw broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
