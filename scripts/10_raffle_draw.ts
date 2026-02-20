#!/usr/bin/env bun
// Draw raffle winner

import { createClientFromArgs, ensureFieldSuffix, getArg, programNames } from "./aleo-utils.ts";

async function main() {
  const raffleIdRaw = getArg("id");
  const seedRaw = getArg("seed");
  if (!raffleIdRaw || !seedRaw) {
    console.error("Usage: --id <field> --seed <u64>");
    process.exit(1);
  }

  const raffleId = ensureFieldSuffix(raffleIdRaw);
  const seed = Number(seedRaw);

  const client = createClientFromArgs();
  const txId = await client.executeBroadcast(
    programNames().rafflePrivate,
    "draw_raffle",
    [raffleId, `${seed}u64`],
  );

  console.log("✅ Draw broadcasted");
  console.log(`Transaction: ${txId}`);
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
