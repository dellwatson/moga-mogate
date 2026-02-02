#!/usr/bin/env bun
/**
 * HOST ver-A Raffle - WORKING SCRIPT
 * Host a new ver-A raffle with auto-draw and auto-claim enabled
 */

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import {
  VER_A_PROGRAM_ID,
  buildUnsafeHostRaffleIx,
  deriveRafflePda,
  deriveSlotsPda,
  deriveTreasuryPda,
} from "../../../ts-sdk/src/verA";

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME || "~", ".config/solana/id.json");

async function main() {
  console.log("\n🚀 HOST ver-A RAFFLE");
  console.log("=".repeat(50));

  const connection = new Connection(RPC_URL, "confirmed");

  // Load CLI wallet
  const wallet = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
  );

  console.log("✅ Wallet:", wallet.publicKey.toBase58());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("✅ Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  const raffleId = "vera-" + Date.now();
  const totalSlots = 10;
  const maxSlotsPerAddress = 5;

  console.log("\n📋 Raffle Details:");
  console.log("Raffle ID:", raffleId);
  console.log("Total Slots:", totalSlots);
  console.log("Max Slots/Address:", maxSlotsPerAddress);
  console.log("Auto Draw: YES");
  console.log("Auto Claim: YES");

  try {
    const hostIx = buildUnsafeHostRaffleIx(
      wallet.publicKey,
      raffleId,
      totalSlots,
      maxSlotsPerAddress,
      "https://example.com/metadata.json",
      new PublicKey("11111111111111111111111111111111"),
      false, // premint_contract
      false, // premint
      wallet.publicKey, // source
      1, // prize_type (SPL token)
      BigInt(1), // prize_amount
      true, // auto_draw
      true, // auto_claim
      BigInt(0), // expires_at
    );

    const tx = new Transaction().add(hostIx);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [wallet],
      { commitment: "confirmed" },
    );

    console.log("\n✅ RAFFLE HOSTED SUCCESSFULLY!");
    console.log("Transaction:", signature);
    console.log("Raffle ID:", raffleId);

    const [rafflePda] = deriveRafflePda(raffleId);
    console.log("Raffle PDA:", rafflePda.toBase58());
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    if (error.logs) {
      console.log("\nLogs:");
      error.logs.forEach((log: string) => console.log(log));
    }
  }
}

main().catch(console.error);
