#!/usr/bin/env bun

/**
 * Join Light Raffle - No Anchor required
 * Usage: SOL_PVT_KEY=<key> bun run join-light-raffle.ts <slotIds...>
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Keypair,
} from "@solana/web3.js";
import {
  LIGHT_RAFFLE_PROGRAM_ID,
  deriveConfigPda,
  deriveRafflePda,
  deriveSlotsPda,
  deriveUserRafflePda,
  deriveTreasuryPda,
  buildUnsafeJoinRaffleIx,
  sendAndConfirm,
} from "./lightRaffle";
import fs from "fs";
import path from "path";

const RPC_URL = "https://api.devnet.solana.com";

// Light Protocol program IDs (placeholders - need actual values)
const LIGHT_STATE_TREE = new PublicKey("11111111111111111111111111111111");
const LIGHT_SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");

async function main() {
  console.log("🎫 Join Light Raffle (No Anchor)");
  console.log("================================\n");

  // Load raffle info
  const raffleInfoPath = path.join(__dirname, "raffle-info.json");
  if (!fs.existsSync(raffleInfoPath)) {
    console.error(
      "❌ raffle-info.json not found. Run host-light-raffle.ts first!",
    );
    process.exit(1);
  }

  const raffleInfo = JSON.parse(fs.readFileSync(raffleInfoPath, "utf-8"));
  console.log(`📋 Raffle Info:`);
  console.log(`   ID: ${raffleInfo.raffleId}`);
  console.log(`   Total Slots: ${raffleInfo.totalSlots}`);
  console.log(`   Raffle PDA: ${raffleInfo.rafflePda}\n`);

  // Parse slot IDs from arguments
  const slotIds = process.argv.slice(2).map((s) => parseInt(s));
  if (slotIds.length === 0) {
    console.error("❌ No slot IDs provided!");
    console.log(
      "Usage: SOL_PVT_KEY=<key> bun run join-light-raffle.ts <slotId1> <slotId2> ...",
    );
    process.exit(1);
  }

  console.log(`🎯 Joining slots: ${slotIds.join(", ")}\n`);

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");
  console.log(`📡 Connected to devnet`);

  // Load wallet from SOL_PVT_KEY env var or default
  let wallet: Keypair;
  if (process.env.SOL_PVT_KEY && process.env.SOL_PVT_KEY.trim().length > 0) {
    try {
      const secretKey = Uint8Array.from(JSON.parse(process.env.SOL_PVT_KEY));
      wallet = Keypair.fromSecretKey(secretKey);
    } catch (e) {
      console.error("❌ Invalid SOL_PVT_KEY format!", e);
      process.exit(1);
    }
  } else {
    // Fallback to default wallet
    const walletPath = path.join(
      process.env.HOME || "~",
      ".config/solana/id.json",
    );
    const secretKey = Uint8Array.from(
      JSON.parse(fs.readFileSync(walletPath, "utf-8")),
    );
    wallet = Keypair.fromSecretKey(secretKey);
  }

  console.log(`👛 Player: ${wallet.publicKey.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  try {
    // Derive PDAs
    const [configPda] = deriveConfigPda();
    const rafflePda = new PublicKey(raffleInfo.rafflePda);
    const slotsPda = new PublicKey(raffleInfo.slotsPda);
    const treasuryPda = new PublicKey(raffleInfo.treasuryPda);
    const [userRafflePda] = deriveUserRafflePda(rafflePda, wallet.publicKey);

    console.log(`🔑 PDAs:`);
    console.log(`   Config: ${configPda.toBase58()}`);
    console.log(`   User Raffle: ${userRafflePda.toBase58()}\n`);

    // Join raffle
    console.log("🚀 Joining raffle...");

    // Calculate payment (0.001 SOL per slot for testing)
    const amountPerSlot = BigInt(1000000); // 0.001 SOL in lamports
    const totalAmount = amountPerSlot * BigInt(slotIds.length);

    const joinRaffleIx = buildUnsafeJoinRaffleIx({
      payer: wallet.publicKey,
      config: configPda,
      raffle: rafflePda,
      slots: slotsPda,
      userRaffle: userRafflePda,
      treasury: treasuryPda,
      slotIds: slotIds,
      amountLamports: totalAmount,
      lightStateTree: LIGHT_STATE_TREE,
      lightSystemProgram: LIGHT_SYSTEM_PROGRAM,
    });

    const tx = await sendAndConfirm(connection, joinRaffleIx, wallet);
    console.log(`✅ Joined raffle: ${tx}`);

    // Verify user raffle account
    const userRaffleAccount = await connection.getAccountInfo(userRafflePda);
    if (userRaffleAccount) {
      console.log(`✅ User raffle account created!`);
      console.log(`   Owner: ${userRaffleAccount.owner.toBase58()}`);
      console.log(`   Lamports: ${userRaffleAccount.lamports}`);
      console.log(`   Data length: ${userRaffleAccount.data.length} bytes`);
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
