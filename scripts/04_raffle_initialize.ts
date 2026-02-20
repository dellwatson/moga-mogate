#!/usr/bin/env bun
// Initialize private darkpool raffle program

import { createClientFromArgs, getArg, programNames } from "./aleo-utils.ts";

async function main() {
  const client = createClientFromArgs();
  const admin = getArg("admin") || client.getAddress();
  const backend = getArg("backend") || admin;
  const treasury = getArg("treasury") || admin;

  console.log("⚙️  Initializing raffle program");
  console.log("================================");
  console.log(`Program:  ${programNames().rafflePrivate}`);
  console.log(`Admin:    ${admin}`);
  console.log(`Backend:  ${backend}`);
  console.log(`Treasury: ${treasury}`);
  console.log("");

  const txId = await client.executeBroadcast(
    programNames().rafflePrivate,
    "initialize",
    [admin, backend, treasury],
  );

  console.log("✅ Initialize broadcasted");
  console.log(`Transaction: ${txId}`);
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
