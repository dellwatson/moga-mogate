/**
 * Initialize Multi-Raffle Config
 *
 * This script sets up the raffle program configuration for the first time.
 * Run this ONCE after deploying the multi_raffle program.
 *
 * The caller becomes the admin and can:
 * - Withdraw proceeds from any raffle
 * - Set refund fee percentage
 *
 * Usage:
 *   bun run scripts/initialize-raffle-config.ts
 *   # or
 *   ts-node scripts/initialize-raffle-config.ts
 *
 * Environment Variables:
 *   SOLANA_NETWORK - devnet or mainnet (default: devnet)
 *   REFUND_FEE_BPS - Refund fee in basis points (default: 500 = 5%)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

// ============================================================================
// Configuration
// ============================================================================

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME!, ".config/solana/id.json");

// Refund fee configuration (charged when users claim refunds)
const REFUND_FEE_BPS = parseInt(process.env.REFUND_FEE_BPS || "500"); // 5% default

// Multi-Raffle Program ID
const PROGRAM_ID = new PublicKey(
  "2qaxQY3shNquV8STxFPoJW6bL9FUAEzUqinZSP163znG",
);

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log("🎰 Initializing Multi-Raffle Configuration");
  console.log("==========================================\n");

  // Load authority wallet (will become admin)
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
  );

  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log("Your Wallet:", walletKeypair.publicKey.toBase58());
  console.log("Refund Fee BPS:", REFUND_FEE_BPS, `(${REFUND_FEE_BPS / 100}%)`);

  // Validate fee
  if (REFUND_FEE_BPS < 0 || REFUND_FEE_BPS > 10000) {
    throw new Error("Refund fee BPS must be between 0 and 10000 (0% to 100%)");
  }

  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program IDL
  const idlPath = path.join(__dirname, "../target/idl/multi_raffle.json");

  let idl;
  if (fs.existsSync(idlPath)) {
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  } else {
    console.log("⚠️  IDL not found, fetching from chain...");
    idl = await Program.fetchIdl(PROGRAM_ID, provider);
    if (!idl) {
      throw new Error(
        "Could not fetch IDL from chain. Build with: anchor build",
      );
    }
  }

  const program = new Program(idl, PROGRAM_ID, provider);

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId,
  );

  console.log("\n📍 Config PDA:", configPda.toBase58());
  console.log("   Bump:", configBump);

  // Check if config already exists
  try {
    const existingConfig = await program.account.config.fetch(configPda);
    console.log("\n⚠️  Config already initialized!");
    console.log("   Admin:", existingConfig.admin.toBase58());
    console.log(
      "   Refund Fee BPS:",
      existingConfig.refundFeeBps,
      `(${existingConfig.refundFeeBps / 100}%)`,
    );

    if (existingConfig.admin.equals(walletKeypair.publicKey)) {
      console.log("\n✅ You are the admin!");
    } else {
      console.log("\n❌ You are NOT the admin!");
      console.log("   Someone else initialized the config first.");
    }

    console.log("\n💡 Config is already set up. No action needed.");
    return;
  } catch (err) {
    // Config doesn't exist, proceed with initialization
    console.log("\n✅ Config not initialized yet, proceeding...");
  }

  console.log("\n🚀 Initializing config...");
  console.log("   You will become the admin!");

  try {
    const tx = await program.methods
      .initializeConfig(REFUND_FEE_BPS)
      .accounts({
        admin: walletKeypair.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Config initialized!");
    console.log("   Transaction:", tx);
    console.log(
      `   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`,
    );

    // Wait for confirmation
    await connection.confirmTransaction(tx, "confirmed");

    // Fetch and display config
    const config = await program.account.config.fetch(configPda);
    console.log("\n📋 Raffle Configuration:");
    console.log("   Admin:", config.admin.toBase58());
    console.log(
      "   Refund Fee BPS:",
      config.refundFeeBps,
      `(${config.refundFeeBps / 100}%)`,
    );

    // Save config info
    const configInfo = {
      network: NETWORK,
      programId: PROGRAM_ID.toBase58(),
      configPda: configPda.toBase58(),
      admin: config.admin.toBase58(),
      refundFeeBps: config.refundFeeBps,
      refundFeePercentage: config.refundFeeBps / 100,
      initializedAt: new Date().toISOString(),
      transaction: tx,
    };

    const outputPath = path.join(
      __dirname,
      `../.raffle-config-${NETWORK}.json`,
    );
    fs.writeFileSync(outputPath, JSON.stringify(configInfo, null, 2));
    console.log("\n💾 Config saved to:", outputPath);

    console.log("\n✨ Setup complete!");
    console.log("\n🎉 You are now the admin!");
    console.log("\n📝 As admin, you can:");
    console.log("   1. Create raffles (unsafe_host_raffle)");
    console.log("   2. Withdraw proceeds from any raffle (withdraw_proceeds)");
    console.log("   3. Update refund fee (set_refund_fee_bps)");
    console.log("\n💡 Next steps:");
    console.log("   - Users can now join raffles and pay SOL");
    console.log("   - Funds accumulate in per-raffle treasury PDAs");
    console.log("   - You can withdraw from any raffle's treasury");
  } catch (error: any) {
    console.error("\n❌ Error initializing config:");
    console.error(error);
    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
