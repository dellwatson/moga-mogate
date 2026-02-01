/**
 * Test Light Raffle - Host raffle with configurable slots
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

// Program ID
const PROGRAM_ID = new PublicKey(
  "6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44",
);

// Network config
const RPC_URL = "https://api.devnet.solana.com";

// Seeds
const CONFIG_SEED = Buffer.from("config");
const RAFFLE_SEED = Buffer.from("raffle");
const SLOTS_SEED = Buffer.from("slots");
const TREASURY_SEED = Buffer.from("treasury");

// Helper to create unsafe_host_raffle instruction data
function createHostRaffleData(
  raffleId: string,
  totalSlots: number,
  maxSlotsPerAddress: number,
  metadataUri: string,
  prizeType: number,
  prizeAmount: number,
  autoDraw: boolean,
  autoClaim: boolean,
  expiresAt: number,
): Buffer {
  // discriminator (8) + raffle_id (4+len) + total_slots (4) + max_slots (4) + metadata_uri (4+len) +
  // collection (1) + premint_contract (1) + premint (1) + prize_type (1) + prize_amount (8) +
  // auto_draw (1) + auto_claim (1) + expires_at (8) = ~50+ bytes
  const raffleIdBuffer = Buffer.from(raffleId, "utf8");
  const metadataUriBuffer = Buffer.from(metadataUri, "utf8");

  const buffer = Buffer.alloc(
    8 +
      4 +
      raffleIdBuffer.length +
      4 +
      4 +
      4 +
      metadataUriBuffer.length +
      1 +
      1 +
      1 +
      1 +
      8 +
      1 +
      1 +
      8,
  );

  // Get discriminator from IDL
  const discriminator = Buffer.from([160, 5, 187, 247, 139, 37, 171, 139]); // unsafe_host_raffle
  discriminator.copy(buffer, 0);

  let offset = 8;

  // raffle_id (string)
  buffer.writeUInt32LE(raffleIdBuffer.length, offset);
  raffleIdBuffer.copy(buffer, offset + 4);
  offset += 4 + raffleIdBuffer.length;

  // total_slots
  buffer.writeUInt32LE(totalSlots, offset);
  offset += 4;

  // max_slots_per_address
  buffer.writeUInt32LE(maxSlotsPerAddress, offset);
  offset += 4;

  // metadata_uri (string)
  buffer.writeUInt32LE(metadataUriBuffer.length, offset);
  metadataUriBuffer.copy(buffer, offset + 4);
  offset += 4 + metadataUriBuffer.length;

  // collection (pubkey) - use default for now
  buffer.writeUInt8(0, offset); // Default pubkey indicator
  offset += 1;

  // premint_contract (bool)
  buffer.writeUInt8(0, offset);
  offset += 1;

  // premint (bool)
  buffer.writeUInt8(0, offset);
  offset += 1;

  // prize_type (u8)
  buffer.writeUInt8(prizeType, offset);
  offset += 1;

  // prize_amount (u64)
  buffer.writeBigUInt64LE(BigInt(prizeAmount), offset);
  offset += 8;

  // auto_draw (bool)
  buffer.writeUInt8(autoDraw ? 1 : 0, offset);
  offset += 1;

  // auto_claim (bool)
  buffer.writeUInt8(autoClaim ? 1 : 0, offset);
  offset += 1;

  // expires_at (i64)
  buffer.writeBigInt64LE(BigInt(expiresAt), offset);

  return buffer;
}

async function main() {
  console.log("🎲 Test Light Raffle - Host");
  console.log("============================\n");

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
  const walletPath = path.join(
    process.env.HOME || "~",
    ".config/solana/id.json",
  );
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))),
  );
  console.log(`👛 Host: ${walletKeypair.publicKey.toBase58()}`);

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  try {
    // Derive PDAs
    const [rafflePda] = PublicKey.findProgramAddressSync(
      [RAFFLE_SEED, Buffer.from(raffleName)],
      PROGRAM_ID,
    );
    const [slotsPda] = PublicKey.findProgramAddressSync(
      [SLOTS_SEED, rafflePda.toBuffer()],
      PROGRAM_ID,
    );
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [TREASURY_SEED, rafflePda.toBuffer()],
      PROGRAM_ID,
    );

    console.log(`🔑 PDAs:`);
    console.log(`   Raffle: ${rafflePda.toBase58()}`);
    console.log(`   Slots: ${slotsPda.toBase58()}`);
    console.log(`   Treasury: ${treasuryPda.toBase58()}\n`);

    // Check if raffle already exists
    const raffleAccount = await connection.getAccountInfo(rafflePda);
    if (raffleAccount) {
      console.log("⚠️  Raffle already exists, skipping creation");
      return;
    }

    // Create instruction data
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now
    const instructionData = createHostRaffleData(
      raffleName,
      slotCount,
      5, // max slots per address
      "https://arweave.net/test-metadata.json",
      1, // SPL token prize type
      1000000, // 0.001 SOL prize
      true, // auto draw
      false, // no auto claim
      expiresAt,
    );

    const instruction = new TransactionInstruction({
      keys: [
        {
          pubkey: walletKeypair.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: new PublicKey("GNBunLjRakBKtGjCrWNfRezY5dVw8ee28erHHeQsqpUX"), // Config PDA
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: rafflePda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: slotsPda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: treasuryPda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletKeypair.publicKey;

    console.log("🚀 Hosting raffle...");

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      {
        commitment: "confirmed",
        maxRetries: 3,
      },
    );

    console.log(`✅ Success! Transaction: ${signature}`);

    // Save raffle info for join test
    const raffleInfo = {
      raffleId: raffleName,
      rafflePda: rafflePda.toBase58(),
      slotsPda: slotsPda.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      totalSlots: slotCount,
      signature: signature,
    };

    fs.writeFileSync(
      path.join(__dirname, "raffle-info.json"),
      JSON.stringify(raffleInfo, null, 2),
    );

    console.log(`💾 Saved raffle info to raffle-info.json`);

    // Verify raffle was created
    const newRaffleAccount = await connection.getAccountInfo(rafflePda);
    if (newRaffleAccount) {
      console.log(`✅ Raffle created successfully!`);
      console.log(`   Owner: ${newRaffleAccount.owner.toBase58()}`);
      console.log(`   Lamports: ${newRaffleAccount.lamports}`);
      console.log(`   Data length: ${newRaffleAccount.data.length} bytes`);
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
