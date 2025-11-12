/**
 * Step 1b: Add Token Metadata to MOGA Token
 * 
 * This script adds Metaplex metadata to your MOGA token so it displays
 * properly in wallets and explorers with name, symbol, and image.
 * 
 * Run this AFTER deploying the token with 1-deploy-moga-token.ts
 * 
 * Usage:
 *   bun run scripts/1b-add-token-metadata.ts
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
  MPL_TOKEN_METADATA_PROGRAM_ID,
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

// Token Metadata
const METADATA = {
  name: "Mogate Token",
  symbol: "MOGA",
  uri: "https://raw.githubusercontent.com/your-org/moga-metadata/main/metadata.json", // TODO: Upload metadata JSON
  // The URI should point to a JSON file with this structure:
  // {
  //   "name": "Mogate Token",
  //   "symbol": "MOGA",
  //   "description": "Mogate platform utility token",
  //   "image": "https://your-cdn.com/moga-logo.png"
  // }
};

// ============================================================================
// Helper Functions
// ============================================================================

function getMetadataPDA(mint: PublicKey): PublicKey {
  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
  return metadata;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("🎨 Adding Token Metadata to MOGA Token\n");
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
      console.log("To update metadata, use update_metadata_account instruction");
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
    console.log("⚠️  Note: You need to upload metadata JSON to the URI:");
    console.log(`  ${METADATA.uri}`);
    console.log();
    console.log("Metadata JSON format:");
    console.log(JSON.stringify({
      name: METADATA.name,
      symbol: METADATA.symbol,
      description: "Mogate platform utility token",
      image: "https://pbs.twimg.com/profile_images/1981074902288351233/_cmsEwgO_400x400.jpg",
      attributes: [],
      properties: {
        files: [
          {
            uri: "https://pbs.twimg.com/profile_images/1981074902288351233/_cmsEwgO_400x400.jpg",
            type: "image/jpeg"
          }
        ],
        category: "fungible-token"
      }
    }, null, 2));

  } catch (error: any) {
    console.error("❌ Error creating metadata:");
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
