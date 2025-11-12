/**
 * Step 2: Create NFT Collections
 *
 * This script creates NFT collections for the platform.
 * Supports multiple collection types: shared, raffle, directSell, luxury, travel, custom.
 *
 * Prerequisites:
 *   - MOGA token deployed (run 1-deploy-moga-token.ts first)
 *   - Metaplex SDK installed: bun add @metaplex-foundation/js
 *
 * Usage:
 *   bun run scripts/2-create-prize-collection.ts [collection-type]
 *
 * Examples:
 *   bun run scripts/2-create-prize-collection.ts shared-1of1   # Shared 1/1 NFTs
 *   bun run scripts/2-create-prize-collection.ts shared-sft    # Shared SFTs (credits)
 *   bun run scripts/2-create-prize-collection.ts luxury        # Luxury RWA (watches, jewelry)
 *   bun run scripts/2-create-prize-collection.ts travel-1of1   # Travel unique bookings
 *   bun run scripts/2-create-prize-collection.ts travel-sft    # Travel credits
 *
 * Available types: shared-1of1, shared-sft, luxury, travel-1of1, travel-sft
 */

import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
} from "@metaplex-foundation/js";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
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

// Collection Configurations
// Support multiple collection types
const COLLECTION_CONFIGS = {
  // Shared MOGATE collections
  "shared-1of1": {
    name: "Mogate Marketplace - Unique Items",
    symbol: "MOGATE-1OF1",
    description: "Verified 1/1 NFTs from Mogate marketplace - curated creators",
    image: "https://arweave.net/mogate-shared-1of1.png",
    externalUrl: "https://mogate.io",
    sellerFeeBasisPoints: 250, // 2.5% platform fee
  },
  
  "shared-sft": {
    name: "Mogate Marketplace - Credits & Vouchers",
    symbol: "MOGATE-SFT",
    description: "Platform credits and vouchers (Semi-Fungible Tokens)",
    image: "https://arweave.net/mogate-shared-sft.png",
    externalUrl: "https://mogate.io",
    sellerFeeBasisPoints: 250,
  },
  
  // Luxury RWA (1/1 only)
  luxury: {
    name: "Mogate Luxury RWA",
    symbol: "MOGATE-LUX",
    description: "High-end luxury items - watches, jewelry, handbags, diamonds",
    image: "https://arweave.net/mogate-luxury.png",
    externalUrl: "https://mogate.io/luxury",
    sellerFeeBasisPoints: 500, // 5% for luxury
  },
  
  // Travel collections
  "travel-1of1": {
    name: "Mogate Travel - Unique Bookings",
    symbol: "MOGATE-TRAVEL",
    description: "Unique flight tickets and hotel bookings with specific booking IDs",
    image: "https://arweave.net/mogate-travel-1of1.png",
    externalUrl: "https://mogate.io/travel",
    sellerFeeBasisPoints: 0,
  },
  
  "travel-sft": {
    name: "Mogate Travel - Credits",
    symbol: "MOGATE-CREDIT",
    description: "Flight and hotel credits (Semi-Fungible Tokens)",
    image: "https://arweave.net/mogate-travel-sft.png",
    externalUrl: "https://mogate.io/travel",
    sellerFeeBasisPoints: 0,
  },
};

// Select which collection to create (via CLI arg or env var)
const COLLECTION_TYPE = process.argv[2] || process.env.COLLECTION_TYPE || "shared-1of1";
const COLLECTION_CONFIG = COLLECTION_CONFIGS[COLLECTION_TYPE as keyof typeof COLLECTION_CONFIGS];

if (!COLLECTION_CONFIG) {
  console.error(`❌ Invalid collection type: ${COLLECTION_TYPE}`);
  console.log(`Available types: ${Object.keys(COLLECTION_CONFIGS).join(", ")}`);
  process.exit(1);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`🚀 Creating ${COLLECTION_TYPE.toUpperCase()} Collection NFT\n`);
  console.log("Collection Type:", COLLECTION_TYPE);
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

  if (balance < 0.1 * 1e9) {
    console.error("❌ Insufficient balance. Need at least 0.1 SOL.");
    if (NETWORK === "devnet") {
      console.log("Get devnet SOL: solana airdrop 2");
    }
    process.exit(1);
  }

  // Check if collection already exists
  const configPath = path.join(__dirname, `../.collection-${COLLECTION_TYPE}-${NETWORK}.json`);
  if (fs.existsSync(configPath)) {
    const existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log(`⚠️  ${COLLECTION_TYPE} collection already created!`);
    console.log("Collection Mint:", existingConfig.collectionMint);
    console.log("Network:", existingConfig.network);
    console.log();
    console.log(`To recreate, delete ${path.basename(configPath)} and run again.`);
    process.exit(0);
  }

  // Initialize Metaplex
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(wallet))
    .use(
      bundlrStorage({
        address:
          NETWORK === "mainnet"
            ? "https://node1.bundlr.network"
            : "https://devnet.bundlr.network",
        providerUrl: RPC_URL,
        timeout: 60000,
      })
    );

  console.log("📝 Step 1: Upload Collection Metadata to Arweave");
  console.log("─".repeat(60));

  // Upload collection metadata
  const { uri: collectionUri } = await metaplex.nfts().uploadMetadata({
    name: COLLECTION_CONFIG.name,
    symbol: COLLECTION_CONFIG.symbol,
    description: COLLECTION_CONFIG.description,
    image: COLLECTION_CONFIG.image,
    external_url: COLLECTION_CONFIG.externalUrl,
    properties: {
      category: "image",
      files: [
        {
          uri: COLLECTION_CONFIG.image,
          type: "image/png",
        },
      ],
    },
  });

  console.log("✅ Metadata uploaded to Arweave");
  console.log("URI:", collectionUri);
  console.log();

  console.log("📝 Step 2: Create Collection NFT");
  console.log("─".repeat(60));

  // Create collection NFT
  const { nft: collection } = await metaplex.nfts().create({
    name: COLLECTION_CONFIG.name,
    symbol: COLLECTION_CONFIG.symbol,
    uri: collectionUri,
    sellerFeeBasisPoints: COLLECTION_CONFIG.sellerFeeBasisPoints,
    isCollection: true,
    updateAuthority: wallet,
    creators: [
      {
        address: wallet.publicKey,
        share: 100,
      },
    ],
  });

  console.log("✅ Collection NFT created");
  console.log("Collection Mint:", collection.address.toBase58());
  console.log(
    "Update Authority:",
    collection.updateAuthorityAddress.toBase58()
  );
  console.log();

  console.log("📝 Step 3: Verify Collection");
  console.log("─".repeat(60));

  const collectionNft = await metaplex.nfts().findByMint({
    mintAddress: collection.address,
  });

  console.log("Name:", collectionNft.name);
  console.log("Symbol:", collectionNft.symbol);
  console.log("URI:", collectionNft.uri);
  console.log("Is Collection:", collectionNft.collectionDetails !== null);
  console.log();

  console.log("📝 Step 4: Save Configuration");
  console.log("─".repeat(60));

  const config = {
    type: COLLECTION_TYPE,
    network: NETWORK,
    collectionMint: collection.address.toBase58(),
    updateAuthority: wallet.publicKey.toBase58(),
    uri: collectionUri,
    createdAt: new Date().toISOString(),
    ...COLLECTION_CONFIG,
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Configuration saved to ${path.basename(configPath)}`);
  console.log();

  console.log("📝 Step 5: Update Environment Variables");
  console.log("─".repeat(60));
  console.log("Add this to your .env file:");
  console.log();
  console.log(
    `COLLECTION_${COLLECTION_TYPE.toUpperCase()}_${NETWORK.toUpperCase()}=${collection.address.toBase58()}`
  );
  console.log();

  console.log(`✅ ${COLLECTION_TYPE} Collection Creation Complete!`);
  console.log();
  console.log("Next steps:");
  console.log("1. Update .env with collection address");
  console.log("2. Create more collections: bun run scripts/2-create-prize-collection.ts <type>");
  console.log(`   Available types: ${Object.keys(COLLECTION_CONFIGS).join(", ")}`);
  console.log("3. Run: bun run scripts/3-delegate-collection-authority.ts");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
