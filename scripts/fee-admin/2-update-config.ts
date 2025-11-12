/**
 * Update Platform Fee Configuration
 * 
 * This script allows the authority to update fee settings.
 * 
 * Usage:
 *   # Update fee percentage
 *   FEE_BPS=300 bun run scripts/fee-admin/2-update-config.ts
 * 
 *   # Update fee wallet
 *   FEE_WALLET=<new_wallet_address> bun run scripts/fee-admin/2-update-config.ts
 * 
 *   # Update both
 *   FEE_BPS=300 FEE_WALLET=<address> bun run scripts/fee-admin/2-update-config.ts
 * 
 * Environment Variables:
 *   SOLANA_NETWORK - devnet or mainnet (default: devnet)
 *   SOLANA_RPC_URL - Custom RPC endpoint (optional)
 *   WALLET_PATH - Path to authority wallet (default: ~/.config/solana/id.json)
 *   FEE_WALLET - New fee wallet address (optional)
 *   FEE_BPS - New fee in basis points (optional)
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

// Update parameters (optional)
const NEW_FEE_BPS = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : null;
const NEW_FEE_WALLET = process.env.FEE_WALLET || null;

// Program ID
const PROGRAM_ID = new PublicKey(
  "DE9rqqvye7rExak5cjYdkBup5wR9PRYMrbZw17xPooCt"
);

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log("🔧 Updating Platform Fee Configuration");
  console.log("========================================\n");

  // Validate inputs
  if (!NEW_FEE_BPS && !NEW_FEE_WALLET) {
    console.log("❌ No updates specified!");
    console.log("\nUsage:");
    console.log("  FEE_BPS=300 bun run scripts/fee-admin/2-update-config.ts");
    console.log("  FEE_WALLET=<address> bun run scripts/fee-admin/2-update-config.ts");
    console.log("  FEE_BPS=300 FEE_WALLET=<address> bun run scripts/fee-admin/2-update-config.ts");
    process.exit(1);
  }

  // Validate fee if provided
  if (NEW_FEE_BPS !== null && (NEW_FEE_BPS < 0 || NEW_FEE_BPS > 1000)) {
    throw new Error("Fee BPS must be between 0 and 1000 (0% to 10%)");
  }

  // Load authority wallet
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
  );

  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log("Authority:", walletKeypair.publicKey.toBase58());

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
      throw new Error("Could not fetch IDL from chain");
    }
  }

  const program = new Program(idl, PROGRAM_ID, provider);

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("\n📍 Config PDA:", configPda.toBase58());

  // Fetch current config
  let currentConfig;
  try {
    currentConfig = await program.account.platformConfig.fetch(configPda);
  } catch (err) {
    console.error("\n❌ Config not initialized!");
    console.log("Run: bun run scripts/fee-admin/1-initialize-config.ts");
    process.exit(1);
  }

  console.log("\n📋 Current Configuration:");
  console.log("   Authority:", currentConfig.authority.toBase58());
  console.log("   Fee Wallet:", currentConfig.feeWallet.toBase58());
  console.log("   Fee BPS:", currentConfig.feeBps, `(${currentConfig.feeBps / 100}%)`);

  // Verify authority
  if (!currentConfig.authority.equals(walletKeypair.publicKey)) {
    console.error("\n❌ Unauthorized!");
    console.log("   Current authority:", currentConfig.authority.toBase58());
    console.log("   Your wallet:", walletKeypair.publicKey.toBase58());
    process.exit(1);
  }

  // Prepare updates
  console.log("\n🔄 Proposed Changes:");
  if (NEW_FEE_BPS !== null) {
    console.log(`   Fee BPS: ${currentConfig.feeBps} → ${NEW_FEE_BPS} (${NEW_FEE_BPS / 100}%)`);
  }
  if (NEW_FEE_WALLET) {
    console.log(`   Fee Wallet: ${currentConfig.feeWallet.toBase58()} → ${NEW_FEE_WALLET}`);
  }

  console.log("\n🚀 Updating config...");

  try {
    const tx = await program.methods
      .updateConfig(
        NEW_FEE_BPS !== null ? NEW_FEE_BPS : null,
        NEW_FEE_WALLET ? new PublicKey(NEW_FEE_WALLET) : null
      )
      .accounts({
        config: configPda,
        authority: walletKeypair.publicKey,
      })
      .rpc();

    console.log("✅ Config updated!");
    console.log("   Transaction:", tx);

    // Fetch and display updated config
    const updatedConfig = await program.account.platformConfig.fetch(configPda);
    console.log("\n📋 Updated Configuration:");
    console.log("   Authority:", updatedConfig.authority.toBase58());
    console.log("   Fee Wallet:", updatedConfig.feeWallet.toBase58());
    console.log("   Fee BPS:", updatedConfig.feeBps, `(${updatedConfig.feeBps / 100}%)`);

    // Update saved config file
    const configPath = path.join(
      __dirname,
      `../../.platform-config-${NETWORK}.json`
    );
    
    if (fs.existsSync(configPath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      savedConfig.feeWallet = updatedConfig.feeWallet.toBase58();
      savedConfig.feeBps = updatedConfig.feeBps;
      savedConfig.feePercentage = updatedConfig.feeBps / 100;
      savedConfig.lastUpdated = new Date().toISOString();
      savedConfig.lastUpdateTx = tx;
      fs.writeFileSync(configPath, JSON.stringify(savedConfig, null, 2));
      console.log("\n💾 Config file updated:", configPath);
    }

    console.log("\n✨ Update complete!");

  } catch (error: any) {
    console.error("\n❌ Error updating config:");
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
