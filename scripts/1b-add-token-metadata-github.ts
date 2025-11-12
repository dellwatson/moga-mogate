/**
 * Step 1b: Add Token Metadata to MOGA Token (GitHub Version)
 * 
 * This script adds Metaplex metadata using GitHub raw URLs.
 * No Arweave upload needed - uses your GitHub repo for metadata.
 * 
 * Run this AFTER deploying the token with 1-deploy-moga-token.ts
 * 
 * Usage:
 *   bun run scripts/1b-add-token-metadata-github.ts
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import fs from "fs";
import path from "path";

// ============================================================================
// Configuration
// ============================================================================

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL =
  process.env.SOLANA_RPC_URL || NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME!, ".config/solana/id.json");

// GitHub repo for metadata
const GITHUB_REPO = "dellwatson/moga-mogate";
const GITHUB_BRANCH = "main";

// Token Metadata - Points to GitHub
const METADATA = {
  name: "Mogate Token",
  symbol: "MOGA",
  uri: `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/metadata/moga-token.json`,
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("🎨 Adding Token Metadata to MOGA Token (GitHub)\n");
  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log();

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Connect to Solana
  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");
  console.log();

  if (balance < 0.01 * 1e9) {
    console.error("❌ Insufficient balance. Need at least 0.01 SOL");
    if (NETWORK === "devnet") {
      console.log("Get devnet SOL: solana airdrop 1");
    }
    process.exit(1);
  }

  // Load MOGA token config
  const configPath = path.join(__dirname, "../.moga-token.json");
  if (!fs.existsSync(configPath)) {
    console.error("❌ MOGA token not found!");
    console.log("Run: bun run scripts/1-deploy-moga-token.ts first");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const mintAddress = new PublicKey(config.mint);
  
  console.log("MOGA Mint:", mintAddress.toBase58());
  console.log();

  // Initialize Metaplex
  console.log("📝 Initializing Metaplex SDK...");
  const metaplex = Metaplex.make(connection).use(keypairIdentity(wallet));
  console.log("✅ Metaplex initialized");
  console.log();

  // Check if metadata already exists
  try {
    const nft = await metaplex.nfts().findByMint({ mintAddress });
    console.log("⚠️  Metadata already exists!");
    console.log("Name:", nft.name);
    console.log("Symbol:", nft.symbol);
    console.log("URI:", nft.uri);
    console.log();
    console.log("💡 To update metadata:");
    console.log("   1. Edit metadata/moga-token.json on GitHub");
    console.log("   2. Metadata will update automatically (no transaction needed)");
    process.exit(0);
  } catch (err) {
    // Metadata doesn't exist, proceed
    console.log("No existing metadata found, creating new...");
    console.log();
  }

  console.log("📝 Creating Token Metadata");
  console.log("─".repeat(60));
  console.log("Name:", METADATA.name);
  console.log("Symbol:", METADATA.symbol);
  console.log("URI:", METADATA.uri);
  console.log();
  console.log("⚠️  Make sure you've pushed metadata/moga-token.json to GitHub!");
  console.log();

  // Verify metadata JSON is accessible
  console.log("🔍 Verifying metadata JSON is accessible...");
  try {
    const response = await fetch(METADATA.uri);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const json = await response.json();
    console.log("✅ Metadata JSON accessible");
    console.log("   Name:", json.name);
    console.log("   Symbol:", json.symbol);
    console.log("   Image:", json.image);
    console.log();
  } catch (error) {
    console.error("❌ Cannot access metadata JSON at:", METADATA.uri);
    console.error("Error:", error);
    console.log();
    console.log("Please:");
    console.log("1. Commit and push metadata/moga-token.json to GitHub");
    console.log("2. Make sure the repo is public");
    console.log("3. Wait a few seconds for GitHub to update");
    console.log();
    process.exit(1);
  }

  console.log("🚀 Creating on-chain metadata account...");
  
  try {
    // Create metadata account
    const { nft } = await metaplex.nfts().create({
      uri: METADATA.uri,
      name: METADATA.name,
      symbol: METADATA.symbol,
      sellerFeeBasisPoints: 0,
      useExistingMint: mintAddress,
      updateAuthority: wallet,
      mintAuthority: wallet,
      tokenOwner: wallet.publicKey,
    });

    console.log("✅ Token metadata created!");
    console.log("Metadata Address:", nft.metadataAddress.toBase58());
    console.log("URI:", METADATA.uri);
    console.log();

    // Update config file
    config.metadataAddress = nft.metadataAddress.toBase58();
    config.metadataUri = METADATA.uri;
    config.metadataCreatedAt = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("✅ Configuration updated");
    console.log();

    console.log("🎉 Token metadata added successfully!");
    console.log();
    console.log("Your token should now display as:");
    console.log(`  Name: ${METADATA.name}`);
    console.log(`  Symbol: ${METADATA.symbol}`);
    console.log();
    console.log("View on Solana Explorer:");
    const explorerUrl = NETWORK === "mainnet"
      ? `https://explorer.solana.com/address/${mintAddress.toBase58()}`
      : `https://explorer.solana.com/address/${mintAddress.toBase58()}?cluster=devnet`;
    console.log(explorerUrl);
    console.log();
    console.log("💡 To update metadata in the future:");
    console.log("   1. Edit metadata/moga-token.json");
    console.log("   2. Commit and push to GitHub");
    console.log("   3. Metadata will update automatically (no transaction needed)");

  } catch (error: any) {
    console.error("\n❌ Error creating metadata:");
    console.error(error);
    
    if (error.message?.includes("already in use")) {
      console.log("\n💡 Metadata account already exists. This is normal if you ran the script before.");
    }
    
    throw error;
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
