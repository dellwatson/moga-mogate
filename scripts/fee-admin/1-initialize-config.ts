/**
 * Initialize Platform Fee Configuration
 * 
 * This script sets up the platform fee system for the first time.
 * Run this ONCE when deploying the program.
 * 
 * Usage:
 *   bun run scripts/fee-admin/1-initialize-config.ts
 * 
 * Environment Variables:
 *   SOLANA_NETWORK - devnet or mainnet (default: devnet)
 *   SOLANA_RPC_URL - Custom RPC endpoint (optional)
 *   WALLET_PATH - Path to authority wallet (default: ~/.config/solana/id.json)
 *   FEE_WALLET - Fee wallet address (optional, defaults to authority wallet)
 *   FEE_BPS - Fee in basis points (default: 250 = 2.5%)
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

// Fee configuration
const FEE_BPS = parseInt(process.env.FEE_BPS || "250"); // 2.5% default
const FEE_WALLET = process.env.FEE_WALLET; // Optional: custom fee wallet

// Program ID
const PROGRAM_ID = new PublicKey(
  "DE9rqqvye7rExak5cjYdkBup5wR9PRYMrbZw17xPooCt"
);

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log("🔧 Initializing Platform Fee Configuration");
  console.log("==========================================\n");

  // Load authority wallet
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
  );

  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log("Authority:", walletKeypair.publicKey.toBase58());
  console.log("Fee BPS:", FEE_BPS, `(${FEE_BPS / 100}%)`);

  // Validate fee
  if (FEE_BPS < 0 || FEE_BPS > 1000) {
    throw new Error("Fee BPS must be between 0 and 1000 (0% to 10%)");
  }

  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program IDL
  const idlPath = path.join(
    __dirname,
    "../../target/idl/direct_sell_anchor.json"
  );
  
  let idl;
  if (fs.existsSync(idlPath)) {
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  } else {
    console.log("⚠️  IDL not found, fetching from chain...");
    idl = await Program.fetchIdl(PROGRAM_ID, provider);
    if (!idl) {
      throw new Error("Could not fetch IDL from chain. Build with: anchor build");
    }
  }

  const program = new Program(idl, PROGRAM_ID, provider);

  // Determine fee wallet
  const feeWalletPubkey = FEE_WALLET
    ? new PublicKey(FEE_WALLET)
    : walletKeypair.publicKey;

  console.log("Fee Wallet:", feeWalletPubkey.toBase58());

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("\n📍 Config PDA:", configPda.toBase58());
  console.log("   Bump:", configBump);

  // Check if config already exists
  try {
    const existingConfig = await program.account.platformConfig.fetch(configPda);
    console.log("\n⚠️  Config already initialized!");
    console.log("   Authority:", existingConfig.authority.toBase58());
    console.log("   Fee Wallet:", existingConfig.feeWallet.toBase58());
    console.log("   Fee BPS:", existingConfig.feeBps, `(${existingConfig.feeBps / 100}%)`);
    console.log("\n💡 Use 2-update-config.ts to modify settings");
    return;
  } catch (err) {
    // Config doesn't exist, proceed with initialization
  }

  console.log("\n🚀 Initializing config...");

  try {
    const tx = await program.methods
      .initializeConfig(FEE_BPS)
      .accounts({
        authority: walletKeypair.publicKey,
        config: configPda,
        feeWallet: feeWalletPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Config initialized!");
    console.log("   Transaction:", tx);

    // Fetch and display config
    const config = await program.account.platformConfig.fetch(configPda);
    console.log("\n📋 Platform Configuration:");
    console.log("   Authority:", config.authority.toBase58());
    console.log("   Fee Wallet:", config.feeWallet.toBase58());
    console.log("   Fee BPS:", config.feeBps, `(${config.feeBps / 100}%)`);
    console.log("   Bump:", config.bump);

    // Save config info
    const configInfo = {
      network: NETWORK,
      programId: PROGRAM_ID.toBase58(),
      configPda: configPda.toBase58(),
      authority: config.authority.toBase58(),
      feeWallet: config.feeWallet.toBase58(),
      feeBps: config.feeBps,
      feePercentage: config.feeBps / 100,
      initializedAt: new Date().toISOString(),
      transaction: tx,
    };

    const outputPath = path.join(
      __dirname,
      `../../.platform-config-${NETWORK}.json`
    );
    fs.writeFileSync(outputPath, JSON.stringify(configInfo, null, 2));
    console.log("\n💾 Config saved to:", outputPath);

    console.log("\n✨ Setup complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. Create token accounts for fee wallet (for each payment mint)");
    console.log("   2. Update your frontend to include config & fee_wallet_ata in buy transactions");
    console.log("   3. Use 2-update-config.ts to change settings");
    console.log("   4. Use 3-withdraw-fees.ts to collect accumulated fees");

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
