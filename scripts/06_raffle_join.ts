#!/usr/bin/env bun
// Join private raffle (unsafe, batch)

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  parseCsvU64,
  isMain,
} from "./aleo-utils.ts";
import { joinRaffleUnsafe } from "../ts-sdk/src/modules/index.ts";

async function main() {
  const client = await createClientFromArgs();

  const raffleIdRaw = getArg("id");
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 2field");
    process.exit(1);
  }
  const raffleId = ensureFieldSuffix(raffleIdRaw);

  const slots = parseCsvU64(getArg("slots"));
  if (!slots.length) {
    console.error("Missing --slots <csv>. Example: --slots 1,2,3");
    process.exit(1);
  }
  if (slots.length > 8) {
    console.error("Max 8 slots per join.");
    process.exit(1);
  }

  const priceMicro = getArg("price-micro");
  const price = parseFloat(getArg("price") || "1.5");
  const microPerSlot = priceMicro
    ? Number(priceMicro)
    : Math.round(price * 1_000_000);

  const amount = microPerSlot * slots.length;

  console.log("🎟️  Joining raffle (unsafe)");
  console.log("===========================");
  console.log("Program:    from ts-sdk config");
  console.log(`Raffle ID:  ${raffleId}`);
  console.log(`Slots:      ${slots.join(", ")}`);
  console.log(`Count:      ${slots.length}`);
  console.log(`Amount:     ${amount} (microcredits)`);
  console.log("");
  const result = await joinRaffleUnsafe(client, {
    raffleId,
    slots,
    amountMicro: amount,
  });

  console.log("✅ Join broadcasted");
  console.log(`Transaction: ${result.txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
