#!/usr/bin/env node
// Burn private NFT from mogate_arc721_multiprivate_v2.aleo

import { createClientFromArgs, getArg, isMain } from "../aleo-utils.ts";
import { programNames } from "../aleo-utils.ts";

// Optional local override. If set, it wins.
const INPUT = {
  program: "",
  nft: "",
};

function pickString(value?: string, fallback?: string): string | undefined {
  const first = value && value.trim().length ? value : undefined;
  if (first) return first;
  const second = fallback && fallback.trim().length ? fallback : undefined;
  return second;
}

function requireRecord(): string {
  const direct = pickString(
    INPUT.nft,
    getArg("nft") || getArg("record") || process.argv[2],
  );
  if (!direct) {
    throw new Error("Missing NFT record. Use --nft '<record>' or pass as first arg.");
  }
  return direct;
}

async function main() {
  const client = await createClientFromArgs();
  const program = pickString(INPUT.program, getArg("program")) || programNames().arc721Private;
  const nftRecord = requireRecord();

  const txId = await client.executeBroadcast(
    program,
    "burn_private",
    [nftRecord],
  );

  console.log("✅ Burn broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
