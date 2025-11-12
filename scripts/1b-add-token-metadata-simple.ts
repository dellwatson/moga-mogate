/**
 * Step 1b: Add Token Metadata to MOGA Token (Simple Version)
 * 
 * This script adds Metaplex metadata using the Metaplex JS SDK.
 * Simpler and more reliable than manual instruction building.
 * 
 * Run this AFTER deploying the token with 1-deploy-moga-token.ts
 * 
 * Usage:
 *   bun run scripts/1b-add-token-metadata-simple.ts
 */

import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Metaplex, keypairIdentity, bundlrStorage } from "@metaplex-foundation/js";
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

// Token Metadata
const METADATA = {
  name: "Mogate Token",
  symbol: "MOGA",
  description: "Mogate platform utility token for RWA raffles and marketplace",
  image: "https://pbs.twimg.com/profile_images/1981074902288351233/_cmsEwgO_400x400.jpg",
  // Optional: Add more metadata
  external_url: "https://mogate.io",
  attributes: [
    {
      trait_type: "Type",
      value: "Utility Token"
    },
    {
      trait_type: "Network",
      value: "Solana"
    }
  ],
  properties: {
    category: "fungible-token",
    files: [
      {
        uri: "https://pbs.twimg.com/profile_images/1981074902288351233/_cmsEwgO_400x400.jpg",
        type: "image/jpeg"
      }
    ]
  }
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("🎨 Adding Token Metadata to MOGA Token (Simple)\n");
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

  if (balance < 0.05 * 1e9) {
    console.error("❌ Insufficient balance. Need at least 0.05 SOL");
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
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(wallet))
    .use(bundlrStorage({
      address: NETWORK === "mainnet" 
        ? "https://node1.bundlr.network"
        : "https://devnet.bundlr.network",
      providerUrl: RPC_URL,
      timeout: 60000,
    }));

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
    console.log("To update, use metaplex.nfts().update()");
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
  console.log("Description:", METADATA.description);
  console.log("Image:", METADATA.image);
  console.log();

  try {
    console.log("🚀 Uploading metadata to Arweave...");
    
    // Upload metadata JSON to Arweave via Bundlr
    const { uri } = await metaplex.nfts().uploadMetadata(METADATA);
    console.log("✅ Metadata uploaded to:", uri);
    console.log();

    console.log("🚀 Creating on-chain metadata account...");
    
    // Create metadata account
    const { nft } = await metaplex.nfts().create({
      uri: uri,
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
    console.log("URI:", uri);
    console.log();

    // Update config file
    config.metadataAddress = nft.metadataAddress.toBase58();
    config.metadataUri = uri;
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

  } catch (error: any) {
    console.error("❌ Error creating metadata:");
    console.error(error);
    
    if (error.message?.includes("Bundlr")) {
      console.log("\n💡 Tip: Bundlr upload failed. You may need to:");
      console.log("1. Wait a few seconds and try again");
      console.log("2. Use a different RPC endpoint");
      console.log("3. Check your SOL balance");
    }
    
    throw error;
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
