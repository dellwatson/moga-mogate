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

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
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
// Helper Functions
// ============================================================================

function getMetadataPDA(mint: PublicKey): PublicKey {
  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return metadata;
}

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
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log("Payer:", payer.publicKey.toBase58());

  // Connect to Solana
  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(payer.publicKey);
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
  const mint = new PublicKey(config.mint);
  
  console.log("MOGA Mint:", mint.toBase58());
  console.log();

  // Derive metadata PDA
  const metadataPDA = getMetadataPDA(mint);
  console.log("Metadata PDA:", metadataPDA.toBase58());
  console.log();

  // Check if metadata already exists
  try {
    const accountInfo = await connection.getAccountInfo(metadataPDA);
    if (accountInfo) {
      console.log("⚠️  Metadata already exists!");
      console.log("Metadata account:", metadataPDA.toBase58());
      console.log();
      console.log("To update metadata, use a different script or Metaplex CLI");
      console.log();
      console.log("Current metadata URI:", METADATA.uri);
      console.log("You can still update the JSON file on GitHub to change metadata");
      process.exit(0);
    }
  } catch (err) {
    // Metadata doesn't exist, proceed
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

  // Create metadata instruction
  const createMetadataIx = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
      mint: mint,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: METADATA.name,
          symbol: METADATA.symbol,
          uri: METADATA.uri,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  // Create and send transaction
  const transaction = new Transaction().add(createMetadataIx);
  
  console.log("🚀 Sending transaction...");
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      { commitment: "confirmed" }
    );

    console.log("✅ Metadata created!");
    console.log("Transaction:", signature);
    console.log("Metadata PDA:", metadataPDA.toBase58());
    console.log();

    // Update config file
    config.metadataPDA = metadataPDA.toBase58();
    config.metadataCreatedAt = new Date().toISOString();
    config.metadataUri = METADATA.uri;
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
      ? `https://explorer.solana.com/address/${mint.toBase58()}`
      : `https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet`;
    console.log(explorerUrl);
    console.log();
    console.log("💡 To update metadata in the future:");
    console.log("   1. Edit metadata/moga-token.json");
    console.log("   2. Commit and push to GitHub");
    console.log("   3. Metadata will update automatically (no transaction needed)");

  } catch (error: any) {
    console.error("\n❌ Error creating metadata:");
    console.error(error);
    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
