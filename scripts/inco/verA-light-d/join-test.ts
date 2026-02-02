/**
 * Join Raffle Test for verA-light
 *
 * Raw transaction test to join raffle with explicit slot selection
 *
 * Usage:
 *   bun run scripts/inco/verA-light/join-test.ts
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
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// Program ID for multi_raffle-inco-A-light
const PROGRAM_ID = new PublicKey(
  "86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o",
);

// Network config
const RPC_URL = "https://api.devnet.solana.com";
const WALLET_PATH = path.join(
  process.env.HOME || "~",
  ".config/solana/id.json",
);

// Seeds
const CONFIG_SEED = Buffer.from("config");
const RAFFLE_SEED = Buffer.from("raffle");
const SLOTS_SEED = Buffer.from("slots");
const USER_SEED = Buffer.from("user");
const TREASURY_SEED = Buffer.from("treasury");

// Derive PDAs
function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
}

function deriveRafflePda(raffleId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [RAFFLE_SEED, Buffer.from(raffleId)],
    PROGRAM_ID,
  );
}

function deriveSlotsPda(raffle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SLOTS_SEED, raffle.toBuffer()],
    PROGRAM_ID,
  );
}

function deriveUserRafflePda(
  raffle: PublicKey,
  user: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_SEED, raffle.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );
}

function deriveTreasuryPda(raffle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, raffle.toBuffer()],
    PROGRAM_ID,
  );
}

// Join instruction data serializer
function serializeJoinRaffleData(
  slotIds: number[],
  amount: number,
  encryptedGuess: Uint8Array,
): Buffer {
  const buffer = Buffer.alloc(1000);
  let offset = 0;

  // Anchor discriminator: first 8 bytes of sha256("global:unsafe_join_raffle")
  const discriminator = createHash("sha256")
    .update("global:unsafe_join_raffle")
    .digest()
    .slice(0, 8);
  discriminator.copy(buffer, offset);
  offset += 8;

  // Slot IDs (vector)
  buffer.writeUInt32LE(slotIds.length, offset);
  offset += 4;
  for (const slotId of slotIds) {
    buffer.writeUInt32LE(slotId, offset);
    offset += 4;
  }

  // Amount
  buffer.writeBigUInt64LE(BigInt(amount), offset);
  offset += 8;

  // Encrypted guess (vector)
  buffer.writeUInt32LE(encryptedGuess.length, offset);
  offset += 4;
  encryptedGuess.copy(buffer, offset);
  offset += encryptedGuess.length;

  return buffer.slice(0, offset);
}

// Main function
async function main() {
  console.log(
    "🎯 Join raffle test for verA-light (Explicit Slots + LIGHT + FHE)",
  );

  // Load previous test result
  const testResultPath = path.join(__dirname, "test-result.json");
  if (!fs.existsSync(testResultPath)) {
    console.error(
      "❌ No raffle test result found. Please run simple-test.ts first.",
    );
    process.exit(1);
  }

  const raffleTest = JSON.parse(fs.readFileSync(testResultPath, "utf8"));
  console.log(`📋 Using raffle: ${raffleTest.raffleId}`);

  // Setup connection and wallet
  const connection = new Connection(RPC_URL, "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))),
  );

  console.log(`👤 Wallet: ${walletKeypair.publicKey.toString()}`);
  console.log(`📋 Program: ${PROGRAM_ID.toString()}`);

  // Join parameters
  const amount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
  const slotIds = [1, 2, 3, 4, 5]; // Explicit slot selection
  const encryptedGuess = Buffer.from("placeholder-encrypted-guess-32-bytes"); // TODO: Replace with actual FHE encrypted guess

  try {
    console.log(`🎟️  Joining raffle with explicit slots`);
    console.log(`💰 Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
    console.log(`🎫 Selected slots: ${slotIds.join(", ")}`);

    // Derive PDAs
    const [configPda] = deriveConfigPda(); // Generate config PDA since it's not in test result
    const rafflePda = new PublicKey(raffleTest.rafflePda);
    const slotsPda = new PublicKey(raffleTest.slotsPda);
    const treasuryPda = new PublicKey(raffleTest.treasuryPda);
    const [userRafflePda, userRaffleBump] = deriveUserRafflePda(
      rafflePda,
      walletKeypair.publicKey,
    );

    console.log(`👤 User Raffle PDA: ${userRafflePda.toString()}`);

    // Create instruction
    const instructionData = serializeJoinRaffleData(
      slotIds,
      amount,
      encryptedGuess,
    );

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true }, // payer
        { pubkey: configPda, isSigner: false, isWritable: false }, // config
        { pubkey: rafflePda, isSigner: false, isWritable: true }, // raffle
        { pubkey: slotsPda, isSigner: false, isWritable: true }, // slots
        { pubkey: userRafflePda, isSigner: false, isWritable: true }, // userRaffle
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // light_state_tree placeholder (system program account)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // light_system_program placeholder (system program account)
        { pubkey: treasuryPda, isSigner: false, isWritable: true }, // treasury
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        {
          pubkey: new PublicKey("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"),
          isSigner: false,
          isWritable: false,
        }, // inco_lightning_program (actual ID)
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);

    console.log(
      `💰 Balance: ${await connection.getBalance(walletKeypair.publicKey)} lamports`,
    );
    console.log(`📤 Sending join transaction...`);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      { commitment: "confirmed" },
    );

    console.log(`✅ Successfully joined raffle!`);
    console.log(
      `🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    );
    console.log(
      `👤 User Raffle: https://explorer.solana.com/account/${userRafflePda.toString()}?cluster=devnet`,
    );

    // Save join result
    const joinResult = {
      success: true,
      raffleId: raffleTest.raffleId,
      userRafflePda: userRafflePda.toString(),
      slotIds,
      amount,
      signature,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "join-result.json"),
      JSON.stringify(joinResult, null, 2),
    );

    console.log(`💾 Join result saved to join-result.json`);
  } catch (error) {
    console.error("❌ Join test failed:", error);

    // Save error result
    const joinResult = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "join-result.json"),
      JSON.stringify(joinResult, null, 2),
    );

    process.exit(1);
  }
}

// Run main
main().catch(console.error);
