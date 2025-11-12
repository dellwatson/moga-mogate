/**
 * View Platform Fee Configuration
 * 
 * This script displays the current platform fee configuration
 * and accumulated fees across all payment tokens.
 * 
 * Usage:
 *   bun run scripts/fee-admin/4-view-config.ts
 * 
 * Environment Variables:
 *   SOLANA_NETWORK - devnet or mainnet (default: devnet)
 *   SOLANA_RPC_URL - Custom RPC endpoint (optional)
 *   CHECK_MINTS - Comma-separated list of mints to check balances (optional)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
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

// Optional: Check balances for specific mints
const CHECK_MINTS = process.env.CHECK_MINTS
  ? process.env.CHECK_MINTS.split(",").map((m) => m.trim())
  : [];

// Program ID
const PROGRAM_ID = new PublicKey(
  "DE9rqqvye7rExak5cjYdkBup5wR9PRYMrbZw17xPooCt"
);

// Common token mints
const COMMON_MINTS: Record<string, { name: string; mint: string }> = {
  devnet: {
    name: "USDC (Devnet)",
    mint: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
  },
  mainnet: {
    name: "USDC (Mainnet)",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
};

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log("📊 Platform Fee Configuration");
  console.log("==============================\n");

  // Load wallet (just for provider, not used for signing)
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
  );

  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);

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
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("\n📍 Config PDA:", configPda.toBase58());
  console.log("   Bump:", configBump);

  // Fetch config
  let config;
  try {
    config = await program.account.platformConfig.fetch(configPda);
  } catch (err) {
    console.error("\n❌ Config not initialized!");
    console.log("Run: bun run scripts/fee-admin/1-initialize-config.ts");
    process.exit(1);
  }

  console.log("\n📋 Configuration:");
  console.log("   Authority:", config.authority.toBase58());
  console.log("   Fee Wallet:", config.feeWallet.toBase58());
  console.log("   Fee BPS:", config.feeBps, `(${config.feeBps / 100}%)`);
  console.log("   Bump:", config.bump);

  // Calculate example fees
  console.log("\n💵 Fee Examples:");
  const examples = [10, 50, 100, 500, 1000];
  examples.forEach((price) => {
    const fee = (price * config.feeBps) / 10000;
    const seller = price - fee;
    console.log(`   $${price} sale → Platform: $${fee.toFixed(2)}, Seller: $${seller.toFixed(2)}`);
  });

  // Check fee wallet balances
  console.log("\n💰 Accumulated Fees:");

  const mintsToCheck = CHECK_MINTS.length > 0
    ? CHECK_MINTS
    : [COMMON_MINTS[NETWORK]?.mint].filter(Boolean);

  if (mintsToCheck.length === 0) {
    console.log("   No mints specified. Use CHECK_MINTS env var to check balances.");
    console.log(`   Example: CHECK_MINTS="${COMMON_MINTS.devnet.mint}" bun run scripts/fee-admin/4-view-config.ts`);
  } else {
    for (const mintAddress of mintsToCheck) {
      try {
        const mint = new PublicKey(mintAddress);
        const feeWalletAta = await getAssociatedTokenAddress(
          mint,
          config.feeWallet
        );

        const balance = await connection.getTokenAccountBalance(feeWalletAta);
        const mintInfo = await connection.getParsedAccountInfo(mint);
        
        let tokenName = mintAddress.substring(0, 8) + "...";
        if (COMMON_MINTS[NETWORK]?.mint === mintAddress) {
          tokenName = COMMON_MINTS[NETWORK].name;
        }

        console.log(`\n   ${tokenName}`);
        console.log(`   Mint: ${mintAddress}`);
        console.log(`   ATA: ${feeWalletAta.toBase58()}`);
        console.log(`   Balance: ${balance.value.uiAmount} ${balance.value.uiAmountString}`);
        console.log(`   Decimals: ${balance.value.decimals}`);
      } catch (err: any) {
        console.log(`\n   ${mintAddress}`);
        console.log(`   ⚠️  Token account not found or error: ${err.message}`);
      }
    }
  }

  // Check for saved config file
  const configPath = path.join(
    __dirname,
    `../../.platform-config-${NETWORK}.json`
  );
  
  if (fs.existsSync(configPath)) {
    const savedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log("\n📁 Saved Config File:", configPath);
    console.log("   Initialized:", savedConfig.initializedAt);
    if (savedConfig.lastUpdated) {
      console.log("   Last Updated:", savedConfig.lastUpdated);
    }
  }

  // Check withdrawal history
  const withdrawalPath = path.join(
    __dirname,
    `../../.fee-withdrawals-${NETWORK}.json`
  );
  
  if (fs.existsSync(withdrawalPath)) {
    const withdrawals = JSON.parse(fs.readFileSync(withdrawalPath, "utf-8"));
    console.log("\n📜 Withdrawal History:");
    console.log(`   Total Withdrawals: ${withdrawals.length}`);
    
    if (withdrawals.length > 0) {
      const recent = withdrawals.slice(-3).reverse();
      console.log("\n   Recent:");
      recent.forEach((w: any) => {
        const date = new Date(w.timestamp).toLocaleString();
        console.log(`   - ${date}: ${w.amount} tokens`);
        console.log(`     Mint: ${w.paymentMint.substring(0, 8)}...`);
        console.log(`     TX: ${w.transaction}`);
      });
    }
  }

  console.log("\n✨ Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
