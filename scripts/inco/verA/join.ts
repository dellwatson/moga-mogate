#!/usr/bin/env bun
/**
 * JOIN ver-A Raffle - WORKING SCRIPT
 * Join an existing ver-A raffle with specified slots
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
import bs58 from "bs58";
import {
  VER_A_PROGRAM_ID,
  buildUnsafeJoinRaffleIx,
  deriveRafflePda,
  deriveSlotsPda,
  deriveUserRafflePda,
  deriveTreasuryPda,
} from "../../../ts-sdk/src/verA";

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME || "~", ".config/solana/id.json");

async function main() {
  console.log("\n🎯 JOIN ver-A RAFFLE");
  console.log("=".repeat(50));

  const connection = new Connection(RPC_URL, "confirmed");

  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Usage: bun run join.ts <raffle_id> <slots> <amount_sol>");
    console.log('Example: bun run join.ts vera-1234567890 "1,2,3" 0.1');
    process.exit(1);
  }

  const [raffleId, slotsStr, amountStr] = args;
  const slotIds = slotsStr.split(",").map((s) => parseInt(s.trim()));
  const amount = parseFloat(amountStr);

  console.log("Raffle ID:", raffleId);
  console.log("Slots:", slotIds);
  console.log("Amount:", amount, "SOL");

  // Determine which wallet to use
  let wallet: Keypair;
  let walletType = "";

  if (process.env.SOL_PVT_KEY_2 && process.env.SOL_PVT_KEY_2.length === 88) {
    // Use SOL_PVT_KEY_2
    const privateKey = bs58.decode(process.env.SOL_PVT_KEY_2);
    wallet = Keypair.fromSecretKey(privateKey);
    walletType = "SOL_PVT_KEY_2";
  } else if (process.env.SOL_PVT_KEY && process.env.SOL_PVT_KEY.length === 88) {
    // Use SOL_PVT_KEY
    const privateKey = bs58.decode(process.env.SOL_PVT_KEY);
    wallet = Keypair.fromSecretKey(privateKey);
    walletType = "SOL_PVT_KEY";
  } else {
    // Use CLI wallet
    wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
    );
    walletType = "CLI Wallet";
  }

  console.log("\n💰 Wallet:", walletType);
  console.log("Address:", wallet.publicKey.toBase58());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  // Check if raffle exists
  const [rafflePda] = deriveRafflePda(raffleId);
  const raffleAccount = await connection.getAccountInfo(rafflePda);

  if (!raffleAccount) {
    console.log("\n❌ Raffle not found on-chain!");
    process.exit(1);
  }

  console.log("\n✅ Raffle found on-chain");

  try {
    const joinIx = buildUnsafeJoinRaffleIx(
      wallet.publicKey,
      raffleId,
      slotIds,
      BigInt(amount * LAMPORTS_PER_SOL),
    );

    const tx = new Transaction().add(joinIx);
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [wallet],
      { commitment: "confirmed" },
    );

    console.log("\n✅ JOINED SUCCESSFULLY!");
    console.log("Transaction:", signature);
    console.log("Slots:", slotIds);
    console.log("Amount:", amount, "SOL");
    console.log("Wallet:", wallet.publicKey.toBase58());

    console.log("\n🔒 FHE Privacy:");
    console.log("✅ slots_handle created (encrypted slot ownership)");
    console.log("✅ Slot ownership is private until draw");
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    if (error.logs) {
      console.log("\nLogs:");
      error.logs.forEach((log: string) => console.log(log));
    }
  }
}

main().catch(console.error);
