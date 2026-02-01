#!/usr/bin/env bun

/**
 * Host Light Raffle - No Anchor required
 * Usage: bun run host-light-raffle.ts <slotCount> <raffleName>
 */

import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  LIGHT_RAFFLE_PROGRAM_ID,
  deriveConfigPda,
  deriveRafflePda,
  deriveSlotsPda,
  deriveTreasuryPda,
  buildInitializeConfigIx,
  buildUnsafeHostRaffleIx,
  loadWallet,
  sendAndConfirm,
} from "./lightRaffle";
import fs from "fs";
import path from "path";

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  console.log("🎲 Host Light Raffle (No Anchor)");
  console.log("===============================\n");

  // Parse arguments
  const slotCount = parseInt(process.argv[2]) || 10;
  const raffleName = process.argv[3] || `light-test-${slotCount}`;

  console.log(`📋 Raffle Config:`);
  console.log(`   Name: ${raffleName}`);
  console.log(`   Slots: ${slotCount}`);
  console.log(`   Max per Address: 5\n`);

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");
  console.log(`📡 Connected to devnet`);

  // Load wallet
  const wallet = await loadWallet();
  console.log(`👛 Host: ${wallet.publicKey.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  try {
    // Derive PDAs
    const [configPda] = deriveConfigPda();
    const [rafflePda] = deriveRafflePda(raffleName);
    const [slotsPda] = deriveSlotsPda(rafflePda);
    const [treasuryPda] = deriveTreasuryPda(rafflePda);

    console.log(`🔑 PDAs:`);
    console.log(`   Config: ${configPda.toBase58()}`);
    console.log(`   Raffle: ${rafflePda.toBase58()}`);
    console.log(`   Slots: ${slotsPda.toBase58()}`);
    console.log(`   Treasury: ${treasuryPda.toBase58()}\n`);

    // Check if config exists, initialize if needed
    try {
      await connection.getAccountInfo(configPda);
      console.log("✅ Config already exists");
    } catch {
      console.log("🔧 Initializing config...");
      const initConfigIx = buildInitializeConfigIx({
        admin: wallet.publicKey,
        config: configPda,
        refundFeeBps: 100, // 1%
      });

      const initTx = await sendAndConfirm(connection, initConfigIx, wallet);
      console.log(`   Config initialized: ${initTx}`);
    }

    // Check if raffle already exists
    const existingRaffle = await connection.getAccountInfo(rafflePda);
    if (existingRaffle) {
      console.log("⚠️  Raffle already exists, skipping creation");
      return;
    }

    // Host raffle
    console.log("🚀 Hosting raffle...");

    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60); // 24 hours from now

    const hostRaffleIx = buildUnsafeHostRaffleIx({
      payer: wallet.publicKey,
      config: configPda,
      raffleId: raffleName,
      totalSlots: slotCount,
      maxSlotsPerAddress: 5,
      metadataUri: "https://arweave.net/test-metadata.json",
      collection: new PublicKey("11111111111111111111111111111111"), // System program for testing
      premintContract: false,
      premint: false,
      prizeType: 1, // SPL token
      prizeAmount: BigInt(1000000), // 0.001 SOL
      autoDraw: true,
      autoClaim: false,
      expiresAt: expiresAt,
    });

    const tx = await sendAndConfirm(connection, hostRaffleIx, wallet);
    console.log(`✅ Raffle hosted: ${tx}`);

    // Save raffle info for join test
    const raffleInfo = {
      raffleId: raffleName,
      rafflePda: rafflePda.toBase58(),
      slotsPda: slotsPda.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      totalSlots: slotCount,
      signature: tx,
      expiresAt: expiresAt.toString(),
    };

    fs.writeFileSync(
      path.join(__dirname, "raffle-info.json"),
      JSON.stringify(raffleInfo, null, 2),
    );

    console.log(`💾 Saved raffle info to raffle-info.json`);

    // Verify raffle was created
    const raffleAccount = await connection.getAccountInfo(rafflePda);
    if (raffleAccount) {
      console.log(`✅ Raffle created successfully!`);
      console.log(`   Owner: ${raffleAccount.owner.toBase58()}`);
      console.log(`   Lamports: ${raffleAccount.lamports}`);
      console.log(`   Data length: ${raffleAccount.data.length} bytes`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    console.log("\n📋 Error details:");
    if (error instanceof Error) {
      console.log("   Type:", error.constructor.name);
      console.log("   Message:", error.message);
      if ("logs" in error) {
        console.log("   Logs:", (error as any).logs);
      }
    }
  }
}

main().catch(console.error);
