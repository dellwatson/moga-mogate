#!/usr/bin/env bun
// Join private raffle (unsafe, batch)

import {
  createClientFromArgs,
  ensureFieldSuffix,
  formatU64Array,
  getArg,
  parseCsvU64,
  programNames,
} from "./aleo-utils.ts";

async function main() {
  const client = createClientFromArgs();

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
  const paymentRecord = await client.findCreditsRecord(amount);
  const paymentString =
    typeof paymentRecord?.toString === "function"
      ? paymentRecord.toString()
      : String(paymentRecord);

  console.log("🎟️  Joining raffle (unsafe)");
  console.log("===========================");
  console.log(`Program:    ${programNames().rafflePrivate}`);
  console.log(`Raffle ID:  ${raffleId}`);
  console.log(`Slots:      ${slots.join(", ")}`);
  console.log(`Count:      ${slots.length}`);
  console.log(`Amount:     ${amount} (microcredits)`);
  console.log("");

  const inputs = [
    raffleId,
    formatU64Array(slots, 8),
    `${slots.length}u8`,
    paymentString,
    `${amount}u64`,
  ];

  const txId = await client.executeBroadcast(
    programNames().rafflePrivate,
    "unsafe_join_raffle",
    inputs,
  );

  console.log("✅ Join broadcasted");
  console.log(`Transaction: ${txId}`);
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
