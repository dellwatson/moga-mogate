/**
 * Step 2b: Mint NFTs/SFTs into Collections
 *
 * This script mints actual NFTs/SFTs into the created collections.
 * Run AFTER creating collections with 2-create-prize-collection.ts
 *
 * Usage:
 *   bun run scripts/2b-mint-collection-nfts.ts [collection-type]
 *
 * Examples:
 *   bun run scripts/2b-mint-collection-nfts.ts shared-1of1
 *   bun run scripts/2b-mint-collection-nfts.ts shared-sft
 *   bun run scripts/2b-mint-collection-nfts.ts luxury
 *   bun run scripts/2b-mint-collection-nfts.ts travel-1of1
 *   bun run scripts/2b-mint-collection-nfts.ts travel-sft
 */

import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
} from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
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

// NFT/SFT Configurations
const NFT_CONFIGS = {
  "shared-1of1": {
    collectionFile: ".collection-shared-1of1-devnet.json",
    items: [
      {
        name: "Mogate Artist #001",
        symbol: "MOGA-ART",
        description: "Digital artwork by emerging artist",
        attributes: [
          { trait_type: "Category", value: "Art" },
          { trait_type: "Rarity", value: "Unique" },
        ],
        supply: 1, // 1/1 NFT
      },
      {
        name: "Mogate Music NFT #001",
        symbol: "MOGA-MUSIC",
        description: "Exclusive music track with royalties",
        attributes: [
          { trait_type: "Category", value: "Music" },
          { trait_type: "Duration", value: "3:45" },
        ],
        supply: 1,
      },
      {
        name: "Mogate Event Ticket #001",
        symbol: "MOGA-EVENT",
        description: "VIP access to exclusive event",
        attributes: [
          { trait_type: "Category", value: "Event" },
          { trait_type: "Access", value: "VIP" },
        ],
        supply: 1,
      },
    ],
  },

  "shared-sft": {
    collectionFile: ".collection-shared-sft-devnet.json",
    items: [
      {
        name: "$10 Platform Credit",
        symbol: "MOGA-CREDIT",
        description: "Redeemable for $10 on Mogate platform",
        attributes: [
          { trait_type: "Value", value: "$10" },
          { trait_type: "Type", value: "Credit" },
        ],
        supply: 100, // SFT with 100 supply
      },
      {
        name: "$50 Platform Credit",
        symbol: "MOGA-CREDIT",
        description: "Redeemable for $50 on Mogate platform",
        attributes: [
          { trait_type: "Value", value: "$50" },
          { trait_type: "Type", value: "Credit" },
        ],
        supply: 50,
      },
      {
        name: "$100 Platform Credit",
        symbol: "MOGA-CREDIT",
        description: "Redeemable for $100 on Mogate platform",
        attributes: [
          { trait_type: "Value", value: "$100" },
          { trait_type: "Type", value: "Credit" },
        ],
        supply: 20,
      },
    ],
  },

  luxury: {
    collectionFile: ".collection-luxury-devnet.json",
    items: [
      // Watches
      {
        name: "Rolex Submariner Date - Steel",
        symbol: "LUXURY-WATCH",
        description: "Authentic Rolex Submariner Date, 41mm, Steel",
        attributes: [
          { trait_type: "Brand", value: "Rolex" },
          { trait_type: "Model", value: "Submariner Date" },
          { trait_type: "Material", value: "Steel" },
          { trait_type: "Size", value: "41mm" },
          { trait_type: "Value", value: "$12,000" },
        ],
        supply: 1,
      },
      {
        name: "Omega Speedmaster Professional",
        symbol: "LUXURY-WATCH",
        description: "Omega Speedmaster Moonwatch, Manual Wind",
        attributes: [
          { trait_type: "Brand", value: "Omega" },
          { trait_type: "Model", value: "Speedmaster" },
          { trait_type: "Movement", value: "Manual" },
          { trait_type: "Value", value: "$6,500" },
        ],
        supply: 1,
      },
      {
        name: "Patek Philippe Calatrava",
        symbol: "LUXURY-WATCH",
        description: "Patek Philippe Calatrava, 18K White Gold",
        attributes: [
          { trait_type: "Brand", value: "Patek Philippe" },
          { trait_type: "Model", value: "Calatrava" },
          { trait_type: "Material", value: "18K White Gold" },
          { trait_type: "Value", value: "$35,000" },
        ],
        supply: 1,
      },

      // Jewelry
      {
        name: "Tiffany & Co. Diamond Ring - 2ct",
        symbol: "LUXURY-JEWELRY",
        description: "Tiffany Setting Diamond Engagement Ring, 2 carat",
        attributes: [
          { trait_type: "Brand", value: "Tiffany & Co." },
          { trait_type: "Type", value: "Ring" },
          { trait_type: "Carat", value: "2.0" },
          { trait_type: "Cut", value: "Round Brilliant" },
          { trait_type: "Value", value: "$45,000" },
        ],
        supply: 1,
      },
      {
        name: "Cartier Love Bracelet - 18K Gold",
        symbol: "LUXURY-JEWELRY",
        description: "Iconic Cartier Love Bracelet in 18K Yellow Gold",
        attributes: [
          { trait_type: "Brand", value: "Cartier" },
          { trait_type: "Type", value: "Bracelet" },
          { trait_type: "Material", value: "18K Yellow Gold" },
          { trait_type: "Value", value: "$7,500" },
        ],
        supply: 1,
      },

      // Handbags
      {
        name: "Hermès Birkin 30 - Togo Leather",
        symbol: "LUXURY-BAG",
        description: "Hermès Birkin 30cm in Étoupe Togo Leather",
        attributes: [
          { trait_type: "Brand", value: "Hermès" },
          { trait_type: "Model", value: "Birkin 30" },
          { trait_type: "Material", value: "Togo Leather" },
          { trait_type: "Color", value: "Étoupe" },
          { trait_type: "Value", value: "$25,000" },
        ],
        supply: 1,
      },
      {
        name: "Chanel Classic Flap - Medium",
        symbol: "LUXURY-BAG",
        description: "Chanel Classic Medium Flap Bag in Black Caviar",
        attributes: [
          { trait_type: "Brand", value: "Chanel" },
          { trait_type: "Model", value: "Classic Flap" },
          { trait_type: "Size", value: "Medium" },
          { trait_type: "Material", value: "Caviar Leather" },
          { trait_type: "Value", value: "$8,500" },
        ],
        supply: 1,
      },
      {
        name: "Louis Vuitton Neverfull MM",
        symbol: "LUXURY-BAG",
        description: "Louis Vuitton Neverfull MM in Monogram Canvas",
        attributes: [
          { trait_type: "Brand", value: "Louis Vuitton" },
          { trait_type: "Model", value: "Neverfull MM" },
          { trait_type: "Pattern", value: "Monogram" },
          { trait_type: "Value", value: "$1,800" },
        ],
        supply: 1,
      },

      // Diamonds
      {
        name: "GIA Certified Diamond - 1.5ct",
        symbol: "LUXURY-DIAMOND",
        description: "GIA Certified Round Brilliant Diamond, 1.5 carat, D/VVS1",
        attributes: [
          { trait_type: "Type", value: "Diamond" },
          { trait_type: "Carat", value: "1.5" },
          { trait_type: "Color", value: "D" },
          { trait_type: "Clarity", value: "VVS1" },
          { trait_type: "Cut", value: "Excellent" },
          { trait_type: "Certification", value: "GIA" },
          { trait_type: "Value", value: "$18,000" },
        ],
        supply: 1,
      },
      {
        name: "GIA Certified Diamond - 3.0ct",
        symbol: "LUXURY-DIAMOND",
        description: "GIA Certified Round Brilliant Diamond, 3.0 carat, E/VS2",
        attributes: [
          { trait_type: "Type", value: "Diamond" },
          { trait_type: "Carat", value: "3.0" },
          { trait_type: "Color", value: "E" },
          { trait_type: "Clarity", value: "VS2" },
          { trait_type: "Cut", value: "Excellent" },
          { trait_type: "Certification", value: "GIA" },
          { trait_type: "Value", value: "$55,000" },
        ],
        supply: 1,
      },

      // Luxury Goods
      {
        name: "Montblanc Meisterstück 149 Fountain Pen",
        symbol: "LUXURY-GOODS",
        description: "Montblanc Meisterstück 149 Fountain Pen, 18K Gold Nib",
        attributes: [
          { trait_type: "Brand", value: "Montblanc" },
          { trait_type: "Type", value: "Fountain Pen" },
          { trait_type: "Nib", value: "18K Gold" },
          { trait_type: "Value", value: "$1,200" },
        ],
        supply: 1,
      },
      {
        name: "Bose QuietComfort Ultra Headphones",
        symbol: "LUXURY-TECH",
        description: "Bose QuietComfort Ultra Wireless Noise Cancelling Headphones",
        attributes: [
          { trait_type: "Brand", value: "Bose" },
          { trait_type: "Type", value: "Headphones" },
          { trait_type: "Feature", value: "Noise Cancelling" },
          { trait_type: "Value", value: "$429" },
        ],
        supply: 1,
      },
    ],
  },

  "travel-1of1": {
    collectionFile: ".collection-travel-1of1-devnet.json",
    items: [
      {
        name: "Qatar Airways Business Class - Doha to Paris",
        symbol: "TRAVEL-FLIGHT",
        description: "One-way Business Class ticket, Doha (DOH) to Paris (CDG)",
        attributes: [
          { trait_type: "Airline", value: "Qatar Airways" },
          { trait_type: "Class", value: "Business" },
          { trait_type: "Route", value: "DOH-CDG" },
          { trait_type: "Value", value: "$3,500" },
          { trait_type: "Booking ID", value: "QR-001-UNIQUE" },
        ],
        supply: 1,
      },
      {
        name: "Emirates First Class - Dubai to New York",
        symbol: "TRAVEL-FLIGHT",
        description: "One-way First Class ticket, Dubai (DXB) to New York (JFK)",
        attributes: [
          { trait_type: "Airline", value: "Emirates" },
          { trait_type: "Class", value: "First" },
          { trait_type: "Route", value: "DXB-JFK" },
          { trait_type: "Value", value: "$8,000" },
          { trait_type: "Booking ID", value: "EK-002-UNIQUE" },
        ],
        supply: 1,
      },
      {
        name: "Singapore Airlines Suites - Singapore to London",
        symbol: "TRAVEL-FLIGHT",
        description: "One-way Suites Class ticket, Singapore (SIN) to London (LHR)",
        attributes: [
          { trait_type: "Airline", value: "Singapore Airlines" },
          { trait_type: "Class", value: "Suites" },
          { trait_type: "Route", value: "SIN-LHR" },
          { trait_type: "Value", value: "$10,000" },
          { trait_type: "Booking ID", value: "SQ-003-UNIQUE" },
        ],
        supply: 1,
      },
      {
        name: "Marriott Bonvoy - 5 Night Stay, Maldives",
        symbol: "TRAVEL-HOTEL",
        description: "5-night stay at St. Regis Maldives Vommuli Resort",
        attributes: [
          { trait_type: "Brand", value: "Marriott Bonvoy" },
          { trait_type: "Property", value: "St. Regis Maldives" },
          { trait_type: "Nights", value: "5" },
          { trait_type: "Value", value: "$5,000" },
          { trait_type: "Booking ID", value: "MAR-004-UNIQUE" },
        ],
        supply: 1,
      },
    ],
  },

  "travel-sft": {
    collectionFile: ".collection-travel-sft-devnet.json",
    items: [
      {
        name: "$500 Any Airline Credit",
        symbol: "TRAVEL-CREDIT",
        description: "Redeemable for $500 on any airline booking",
        attributes: [
          { trait_type: "Value", value: "$500" },
          { trait_type: "Type", value: "Flight Credit" },
          { trait_type: "Airline", value: "Any" },
        ],
        supply: 100,
      },
      {
        name: "$500 Qatar Airways Credit",
        symbol: "TRAVEL-CREDIT",
        description: "Redeemable for $500 on Qatar Airways bookings only",
        attributes: [
          { trait_type: "Value", value: "$500" },
          { trait_type: "Type", value: "Flight Credit" },
          { trait_type: "Airline", value: "Qatar Airways" },
        ],
        supply: 50,
      },
      {
        name: "$800 Qatar Airways Credit",
        symbol: "TRAVEL-CREDIT",
        description: "Redeemable for $800 on Qatar Airways bookings only",
        attributes: [
          { trait_type: "Value", value: "$800" },
          { trait_type: "Type", value: "Flight Credit" },
          { trait_type: "Airline", value: "Qatar Airways" },
        ],
        supply: 30,
      },
      {
        name: "$1000 Emirates Credit",
        symbol: "TRAVEL-CREDIT",
        description: "Redeemable for $1000 on Emirates bookings only",
        attributes: [
          { trait_type: "Value", value: "$1000" },
          { trait_type: "Type", value: "Flight Credit" },
          { trait_type: "Airline", value: "Emirates" },
        ],
        supply: 20,
      },
      {
        name: "$300 Hotel Credit - Any Property",
        symbol: "TRAVEL-HOTEL",
        description: "Redeemable for $300 at any partnered hotel",
        attributes: [
          { trait_type: "Value", value: "$300" },
          { trait_type: "Type", value: "Hotel Credit" },
          { trait_type: "Brand", value: "Any" },
        ],
        supply: 80,
      },
    ],
  },
};

// Select which collection to mint into
const COLLECTION_TYPE = process.argv[2] || process.env.COLLECTION_TYPE || "shared-1of1";
const CONFIG = NFT_CONFIGS[COLLECTION_TYPE as keyof typeof NFT_CONFIGS];

if (!CONFIG) {
  console.error(`❌ Invalid collection type: ${COLLECTION_TYPE}`);
  console.log(`Available types: ${Object.keys(NFT_CONFIGS).join(", ")}`);
  process.exit(1);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`🚀 Minting NFTs/SFTs into ${COLLECTION_TYPE.toUpperCase()} Collection\n`);
  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log();

  // Load collection config
  const configPath = path.join(__dirname, "..", CONFIG.collectionFile);
  if (!fs.existsSync(configPath)) {
    console.error(`❌ Collection not found: ${CONFIG.collectionFile}`);
    console.log(`Run: bun run scripts/2-create-prize-collection.ts ${COLLECTION_TYPE}`);
    process.exit(1);
  }

  const collectionConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const collectionMint = new PublicKey(collectionConfig.collectionMint);
  console.log("Collection Mint:", collectionMint.toBase58());
  console.log("Items to mint:", CONFIG.items.length);
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

  if (balance < 0.5 * 1e9) {
    console.error("❌ Insufficient balance. Need at least 0.5 SOL.");
    process.exit(1);
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

  // Mint each NFT/SFT
  const mintedNfts = [];
  for (let i = 0; i < CONFIG.items.length; i++) {
    const item = CONFIG.items[i];
    console.log(`\n📝 Minting ${i + 1}/${CONFIG.items.length}: ${item.name}`);
    console.log("─".repeat(60));

    // Upload metadata
    const { uri } = await metaplex.nfts().uploadMetadata({
      name: item.name,
      symbol: item.symbol,
      description: item.description,
      image: `https://arweave.net/placeholder-${COLLECTION_TYPE}-${i}.png`, // TODO: Upload actual images
      attributes: item.attributes,
      properties: {
        category: "image",
        files: [
          {
            uri: `https://arweave.net/placeholder-${COLLECTION_TYPE}-${i}.png`,
            type: "image/png",
          },
        ],
      },
    });

    console.log("✅ Metadata uploaded:", uri);

    // Mint NFT/SFT
    const { nft } = await metaplex.nfts().create({
      name: item.name,
      symbol: item.symbol,
      uri,
      sellerFeeBasisPoints: 0,
      maxSupply: item.supply > 1 ? item.supply : undefined, // SFT if supply > 1
      collection: collectionMint,
      creators: [
        {
          address: wallet.publicKey,
          share: 100,
        },
      ],
    });

    console.log("✅ Minted:", nft.address.toBase58());
    console.log("   Supply:", item.supply);
    console.log("   Type:", item.supply === 1 ? "1/1 NFT" : `SFT (${item.supply} supply)`);

    mintedNfts.push({
      mint: nft.address.toBase58(),
      name: item.name,
      supply: item.supply,
      uri,
    });
  }

  // Save minted NFTs list
  const outputPath = path.join(__dirname, "..", `.minted-${COLLECTION_TYPE}-${NETWORK}.json`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        collectionType: COLLECTION_TYPE,
        collectionMint: collectionMint.toBase58(),
        network: NETWORK,
        mintedAt: new Date().toISOString(),
        nfts: mintedNfts,
      },
      null,
      2
    )
  );

  console.log(`\n✅ Minting Complete!`);
  console.log(`Minted ${mintedNfts.length} NFTs/SFTs`);
  console.log(`Saved to: ${path.basename(outputPath)}`);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
