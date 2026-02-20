#!/usr/bin/env bun
// Initialize private darkpool raffle program

import { createClientFromArgs, getArg, isMain } from "./aleo-utils.ts";
import { initializeRafflePrivate } from "../ts-sdk/src/modules/index.ts";

async function main() {
  const client = await createClientFromArgs();
  const admin = getArg("admin") || client.getAddress();
  const backend = getArg("backend") || admin;
  const treasury = getArg("treasury") || admin;

  console.log("⚙️  Initializing raffle program");
  console.log("================================");
  console.log("Program:  from ts-sdk config");
  console.log(`Admin:    ${admin}`);
  console.log(`Backend:  ${backend}`);
  console.log(`Treasury: ${treasury}`);
  console.log("");

  const txId = await initializeRafflePrivate(client, {
    admin,
    backend,
    treasury,
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
