/**
 * Simple Test for verA-light
 *
 * Raw transaction test to verify deployed LIGHT program works
 *
 * Usage:
 *   bun run scripts/inco/verA-light/simple-test.ts
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

function deriveTreasuryPda(raffle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, raffle.toBuffer()],
    PROGRAM_ID,
  );
}

// Config discriminator: first 8 bytes of sha256("global:initialize_config")
function serializeInitializeConfigData(refundFeeBps: number): Buffer {
  const buffer = Buffer.alloc(100);
  let offset = 0;

  const discriminator = createHash("sha256")
    .update("global:initialize_config")
    .digest()
    .slice(0, 8);
  discriminator.copy(buffer, offset);
  offset += 8;

  buffer.writeUInt16LE(refundFeeBps, offset);
  offset += 2;

  return buffer.slice(0, offset);
}

// Simple instruction data serializer (minimal)
function serializeHostRaffleData(
  raffleId: string,
  totalSlots: number,
  maxSlotsPerAddress: number,
  metadataUri: string,
  collection: PublicKey,
  prizeType: number,
  prizeAmount: number,
  expiresAt: number,
): Buffer {
  const buffer = Buffer.alloc(1000); // Large enough buffer
  let offset = 0;

  // Anchor discriminator: first 8 bytes of sha256("global:unsafe_host_raffle")
  const discriminator = createHash("sha256")
    .update("global:unsafe_host_raffle")
    .digest()
    .slice(0, 8);
  discriminator.copy(buffer, offset);
  offset += 8;

  // Simple string serialization (length + bytes)
  const raffleIdBytes = Buffer.from(raffleId);
  buffer.writeUInt32LE(raffleIdBytes.length, offset);
  offset += 4;
  raffleIdBytes.copy(buffer, offset);
  offset += raffleIdBytes.length;

  // Numbers
  buffer.writeUInt32LE(totalSlots, offset);
  offset += 4;
  buffer.writeUInt32LE(maxSlotsPerAddress, offset);
  offset += 4;

  // Metadata URI
  const metadataBytes = Buffer.from(metadataUri);
  buffer.writeUInt32LE(metadataBytes.length, offset);
  offset += 4;
  metadataBytes.copy(buffer, offset);
  offset += metadataBytes.length;

  // Collection (32 bytes)
  collection.toBuffer().copy(buffer, offset);
  offset += 32;

  // Booleans (premintContract, premint)
  buffer.writeUInt8(0, offset);
  offset += 1; // premintContract
  buffer.writeUInt8(0, offset);
  offset += 1; // premint

  // Prize info
  buffer.writeUInt8(prizeType, offset);
  offset += 1;
  buffer.writeBigUInt64LE(BigInt(prizeAmount), offset);
  offset += 8;

  // Booleans (autoDraw, autoClaim)
  buffer.writeUInt8(1, offset);
  offset += 1; // autoDraw
  buffer.writeUInt8(0, offset);
  offset += 1; // autoClaim

  // Expiration
  buffer.writeBigInt64LE(BigInt(expiresAt), offset);
  offset += 8;

  return buffer.slice(0, offset);
}

// Main function
async function main() {
  console.log("🎯 Simple test for verA-light (Raw Transaction)");

  // Setup connection and wallet
  const connection = new Connection(RPC_URL, "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))),
  );

  console.log(`👤 Wallet: ${walletKeypair.publicKey.toString()}`);
  console.log(`📋 Program: ${PROGRAM_ID.toString()}`);

  // Test parameters
  const raffleId = `test-${Date.now()}`;
  const totalSlots = 1000;
  const maxSlotsPerAddress = 10;
  const metadataUri = "https://example.com/test";
  const collection = new PublicKey("11111111111111111111111111111112");
  const prizeType = 0;
  const prizeAmount = 0;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  try {
    console.log(`📝 Testing raffle creation: ${raffleId}`);

    // Derive PDAs first
    const [configPda] = deriveConfigPda();
    const [rafflePda, raffleBump] = deriveRafflePda(raffleId);
    const [slotsPda, slotsBump] = deriveSlotsPda(rafflePda);
    const [treasuryPda, treasuryBump] = deriveTreasuryPda(rafflePda);

    console.log(`🎫 Raffle PDA: ${rafflePda.toString()}`);
    console.log(`💎 Slots PDA: ${slotsPda.toString()}`);
    console.log(`🏦 Treasury PDA: ${treasuryPda.toString()}`);

    // Initialize config first
    console.log(`⚙️ Initializing config...`);
    const configInstructionData = serializeInitializeConfigData(100); // 1% refund fee

    const configInstruction = new TransactionInstruction({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true }, // admin
        { pubkey: configPda, isSigner: false, isWritable: true }, // config
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: PROGRAM_ID,
      data: configInstructionData,
    });

    const configTx = new Transaction().add(configInstruction);
    const configSignature = await sendAndConfirmTransaction(
      connection,
      configTx,
      [walletKeypair],
      { commitment: "confirmed" },
    );

    console.log(`✅ Config initialized!`);
    console.log(
      `🔗 Config TX: https://explorer.solana.com/tx/${configSignature}?cluster=devnet`,
    );

    // Create instruction
    const instructionData = serializeHostRaffleData(
      raffleId,
      totalSlots,
      maxSlotsPerAddress,
      metadataUri,
      collection,
      prizeType,
      prizeAmount,
      expiresAt,
    );

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true }, // payer (first, must sign)
        { pubkey: configPda, isSigner: false, isWritable: false }, // config (second)
        { pubkey: rafflePda, isSigner: false, isWritable: true }, // raffle
        { pubkey: slotsPda, isSigner: false, isWritable: true }, // slots
        { pubkey: treasuryPda, isSigner: false, isWritable: true }, // treasury
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);

    console.log(
      `💰 Balance: ${await connection.getBalance(walletKeypair.publicKey)} lamports`,
    );
    console.log(`📤 Sending transaction...`);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      { commitment: "confirmed" },
    );

    console.log(`✅ Transaction successful!`);
    console.log(
      `🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    );
    console.log(
      `📋 Raffle: https://explorer.solana.com/account/${rafflePda.toString()}?cluster=devnet`,
    );

    // Save test result
    const testResult = {
      success: true,
      raffleId,
      rafflePda: rafflePda.toString(),
      slotsPda: slotsPda.toString(),
      treasuryPda: treasuryPda.toString(),
      signature,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "test-result.json"),
      JSON.stringify(testResult, null, 2),
    );

    console.log(`💾 Test result saved to test-result.json`);
  } catch (error) {
    console.error("❌ Test failed:", error);

    // Save error result
    const testResult = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "test-result.json"),
      JSON.stringify(testResult, null, 2),
    );

    process.exit(1);
  }
}

// Run main
main().catch(console.error);
