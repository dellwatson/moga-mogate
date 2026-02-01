/**
 * Minimal test for Light raffle - bypass account namespace
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
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

async function main() {
  console.log("🧪 Minimal Light Raffle Test");
  console.log("==========================\n");

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

  // Setup Anchor with minimal IDL
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(walletKeypair),
    { commitment: "confirmed" },
  );

  // Create minimal IDL with just the instruction we need
  const minimalIdl = {
    address: PROGRAM_ID.toString(),
    instructions: [
      {
        name: "initializeConfig",
        accounts: [
          { name: "admin", isMut: true, isSigner: true },
          { name: "config", isMut: true, isSigner: false },
          { name: "systemProgram", isMut: false, isSigner: false },
        ],
        args: [
          { name: "admin", type: "publicKey" },
          { name: "refundFeeBps", type: "u16" },
        ],
      },
    ],
  };

  try {
    // Create program with minimal IDL
    const program = new anchor.Program(minimalIdl, PROGRAM_ID, provider);

    console.log("✅ Program created successfully!");
    console.log(`   Program ID: ${program.programId.toBase58()}`);

    // Derive config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
      [CONFIG_SEED],
      PROGRAM_ID,
    );
    console.log(`   Config PDA: ${configPda.toBase58()}`);

    // Try to call initialize_config
    console.log("\n🔧 Testing initialize_config...");

    const tx = await program.methods
      .initializeConfig(walletKeypair.publicKey, 100) // 1% fee
      .accounts({
        admin: walletKeypair.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Success! Transaction: ${tx}`);
  } catch (error) {
    console.error("❌ Error:", error);
    console.log("\n📋 Error details:");
    console.log("   Type:", error.constructor.name);
    console.log("   Message:", error.message);
  }
}

main().catch(console.error);
