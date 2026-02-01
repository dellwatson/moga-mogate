/**
 * Raw transaction test for Light raffle - bypass Anchor completely
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

// Helper to create instruction data
function createInitializeConfigData(refundFeeBps: number): Buffer {
  const buffer = Buffer.alloc(10); // discriminator (8) + fee (2)

  // Instruction discriminator for initialize_config (8 bytes from regenerated IDL)
  const discriminator = Buffer.from([208, 127, 21, 1, 194, 190, 196, 70]);
  discriminator.copy(buffer, 0);

  // Refund fee BPS (2 bytes, little endian)
  buffer.writeUInt16LE(refundFeeBps, 8);

  return buffer;
}

async function main() {
  console.log("🔧 Raw Transaction Test for Light Raffle");
  console.log("========================================\n");

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
  console.log(`👛 Wallet: ${walletKeypair.publicKey.toBase58()}`);

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  try {
    // Derive config PDA
    const [configPda, configBump] = PublicKey.findProgramAddressSync(
      [CONFIG_SEED],
      PROGRAM_ID,
    );
    console.log(`🔑 Config PDA: ${configPda.toBase58()}`);
    console.log(`   Bump: ${configBump}`);

    // Check if config already exists
    const configAccount = await connection.getAccountInfo(configPda);
    if (configAccount) {
      console.log("  Config already exists, skipping initialization");
      return;
    }

    // Create initialize_config instruction
    const instructionData = createInitializeConfigData(100);

    const instruction = new TransactionInstruction({
      keys: [
        {
          pubkey: walletKeypair.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: configPda,
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

    console.log("🚀 Sending initialize_config transaction...");

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

    // Verify config was created
    const newConfigAccount = await connection.getAccountInfo(configPda);
    if (newConfigAccount) {
      console.log(`✅ Config account created successfully!`);
      console.log(`   Owner: ${newConfigAccount.owner.toBase58()}`);
      console.log(`   Lamports: ${newConfigAccount.lamports}`);
      console.log(`   Data length: ${newConfigAccount.data.length} bytes`);
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
