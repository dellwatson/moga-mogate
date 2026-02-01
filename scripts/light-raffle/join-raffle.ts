/**
 * ZK-Compressed Raffle Join Script
 *
 * This script joins a Light Protocol ZK-compressed raffle by building
 * raw Solana transactions (no Anchor framework).
 *
 * WHY RAW TRANSACTIONS?
 * - Anchor IDL parsing issues with account deserialization
 * - More control over instruction data serialization
 * - Simpler and more reliable for production use
 *
 * LIGHT PROTOCOL INTEGRATION:
 * ZK-compressed raffles require 2 additional accounts:
 * 1. lightStateTree - Light Protocol's state compression tree
 * 2. lightSystemProgram - Light Protocol's system program
 *
 * These enable storing slot ownership in compressed accounts instead
 * of a giant on-chain array, reducing costs by ~200x.
 *
 * Usage:
 *   WALLET=account1 bun run scripts/light-raffle/join-raffle.ts 1,2,3
 *   WALLET=account2 bun run scripts/light-raffle/join-raffle.ts 10,11,12
 *   WALLET=account3 bun run scripts/light-raffle/join-raffle.ts 49,50
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const PROGRAM_ID = new PublicKey(
  "6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44",
);
const RPC_URL = "https://api.devnet.solana.com";
const WALLET_PATH = path.join(
  process.env.HOME || "~",
  ".config/solana/id.json",
);

// Light Protocol addresses for devnet
// These are REQUIRED for ZK-compressed raffles to work
// They enable storing slot ownership in compressed accounts
const LIGHT_STATE_TREE = new PublicKey(
  "CmtE9W6JZHSKJuZkZvJy6vLJkZ8KnKJzKxDLQjLvVJHw",
); // Light Protocol's state compression tree (stores compressed account data)
const LIGHT_SYSTEM_PROGRAM = new PublicKey(
  "H5sFv8VwWmjxHYS2GB4fTDsK7uTtnRT4WiixtHrET3bN",
); // Light Protocol's system program (manages compressed accounts)

// Build discriminator for unsafe_join_raffle
async function getDiscriminator(name: string): Promise<Buffer> {
  const preimage = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest("SHA-256", preimage);
  return Buffer.from(new Uint8Array(hash).slice(0, 8));
}

/**
 * Serialize instruction arguments for unsafe_join_raffle
 *
 * Rust signature:
 * pub fn unsafe_join_raffle(
 *     ctx: Context<UnsafeJoinRaffle>,
 *     slot_ids: Vec<u32>,
 *     amount: u64,
 *     merkle_proofs: Vec<Vec<[u8; 32]>>,
 * ) -> Result<()>
 *
 * Borsh serialization format:
 * - Vec<T> = [4-byte length][elements...]
 * - u32 = 4 bytes little-endian
 * - u64 = 8 bytes little-endian
 */
function serializeArgs(slotIds: number[], amount: number): Buffer {
  // Vec<u32> slot_ids - 4 bytes length + 4 bytes per slot
  const slotIdsBuffer = Buffer.alloc(4 + slotIds.length * 4);
  slotIdsBuffer.writeUInt32LE(slotIds.length, 0);
  slotIds.forEach((slot, idx) => {
    slotIdsBuffer.writeUInt32LE(slot, 4 + idx * 4);
  });

  // u64 amount (in lamports)
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amount), 0);

  // Vec<Vec<[u8; 32]>> merkle_proofs
  // For "unsafe" join, we pass an empty vector (no ZK proofs needed)
  // Just 4 bytes for length = 0
  const merkleProofsBuffer = Buffer.alloc(4);
  merkleProofsBuffer.writeUInt32LE(0, 0);

  return Buffer.concat([slotIdsBuffer, amountBuffer, merkleProofsBuffer]);
}

async function main() {
  const slotsArg = process.argv[2];
  if (!slotsArg) {
    console.error(
      "Usage: WALLET=account1|account2|account3 bun run RAW-join.ts 1,2,3",
    );
    process.exit(1);
  }

  const slotIds = slotsArg.split(",").map((s) => parseInt(s.trim()));
  const walletType = process.env.WALLET || "account1";

  console.log(`💳 RAW Join - ${walletType}`);
  console.log(`   Slots: [${slotIds.join(", ")}]\n`);

  const connection = new Connection(RPC_URL, "confirmed");

  // Load wallet
  let walletKeypair: Keypair;
  if (walletType === "account1") {
    walletKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
    );
  } else if (walletType === "account2") {
    const bs58 = await import("bs58");
    walletKeypair = Keypair.fromSecretKey(
      bs58.default.decode(process.env.SOL_PVT_KEY!),
    );
  } else if (walletType === "account3") {
    const bs58 = await import("bs58");
    walletKeypair = Keypair.fromSecretKey(
      bs58.default.decode(process.env.SOL_PVT_KEY_2!),
    );
  } else {
    throw new Error(`Unknown wallet: ${walletType}`);
  }

  console.log(`Wallet: ${walletKeypair.publicKey.toBase58()}`);
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  // Load raffle info
  const info = JSON.parse(
    fs.readFileSync(path.join(__dirname, "raffle-info.json"), "utf-8"),
  );

  const rafflePda = new PublicKey(info.rafflePda);
  const slotsPda = new PublicKey(info.slotsPda);
  const treasuryPda = new PublicKey(info.treasuryPda);
  const configPda = new PublicKey(info.configPda);

  // Derive user raffle PDA
  const [userRafflePda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("user"),
      rafflePda.toBuffer(),
      walletKeypair.publicKey.toBuffer(),
    ],
    PROGRAM_ID,
  );

  const amount = Math.floor(slotIds.length * 0.0085 * LAMPORTS_PER_SOL);

  console.log(`Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
  console.log(`User Raffle PDA: ${userRafflePda.toBase58()}\n`);

  // Build instruction data
  const discriminator = await getDiscriminator("unsafe_join_raffle");
  const args = serializeArgs(slotIds, amount);
  const data = Buffer.concat([discriminator, args]);

  console.log(`Instruction data: ${data.toString("hex")}\n`);

  // Build instruction
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: configPda, isSigner: false, isWritable: false }, // config
      { pubkey: rafflePda, isSigner: false, isWritable: true }, // raffle
      { pubkey: slotsPda, isSigner: false, isWritable: true }, // slots
      { pubkey: userRafflePda, isSigner: false, isWritable: true }, // user_raffle
      { pubkey: LIGHT_STATE_TREE, isSigner: false, isWritable: false }, // light_state_tree
      { pubkey: LIGHT_SYSTEM_PROGRAM, isSigner: false, isWritable: false }, // light_system_program
      { pubkey: treasuryPda, isSigner: false, isWritable: true }, // treasury
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data,
  });

  // Build transaction
  const transaction = new Transaction().add(instruction);

  try {
    console.log("Sending transaction...");
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      { commitment: "confirmed" },
    );

    console.log(`\n✅ SUCCESS!`);
    console.log(`Signature: ${signature}`);
    console.log(
      `\nExplorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    );
    console.log(`\nBooked slots: [${slotIds.join(", ")}]`);
  } catch (error: any) {
    console.error(`\n❌ ERROR: ${error.message || error}`);
    if (error.logs) {
      console.error("\nProgram Logs:");
      error.logs.forEach((log: string) => console.error(`   ${log}`));
    }
    process.exit(1);
  }
}

main();
