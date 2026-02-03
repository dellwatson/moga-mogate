#!/usr/bin/env node
/**
 * Burn NFT - Simple JavaScript Version
 * Burns an NFT from the collection using the NFT record
 */

const { execSync } = require("child_process");
const path = require("path");

// Configuration
const ENDPOINT = "https://api.provable.com/v2";
const NETWORK = "testnet";
const COLLECTION_PROGRAM = "mogate_nft_collection_rwa.aleo";

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error("❌ Error: Token ID required\n");
  console.log("Usage: node burn-nft-simple.js <TOKEN_ID> [OWNER] [URI_HASH]\n");
  console.log("Example:");
  console.log("  node burn-nft-simple.js 1");
  console.log(
    "  node burn-nft-simple.js 1 aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2 123456field\n",
  );
  process.exit(1);
}

const tokenId = args[0];
const owner =
  args[1] || "aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2";
const uriHash = args[2] || "0field";

console.log("🔥 Burning NFT...\n");
console.log(`Token ID: ${tokenId}`);
console.log(`Owner: ${owner}`);
console.log(`URI Hash: ${uriHash}`);
console.log(`Collection: ${COLLECTION_PROGRAM}\n`);

// Build NFT record
const nftRecord = `{owner: ${owner}, token_id: ${tokenId}u64, uri: ${uriHash}, collection: ${COLLECTION_PROGRAM}}`;

console.log("📝 NFT Record:", nftRecord);
console.log(
  "\n⚠️  WARNING: This will permanently delete the NFT from the collection!\n",
);

try {
  // Change to collection directory
  const collectionDir = path.join(__dirname, "../../programs/collection");

  // Execute burn command
  const command = `leo execute burn "${nftRecord}" --network ${NETWORK} --endpoint ${ENDPOINT} --broadcast`;

  console.log("Executing command...\n");

  const output = execSync(command, {
    cwd: collectionDir,
    stdio: "inherit",
    encoding: "utf-8",
  });

  console.log("\n✅ NFT burned successfully!\n");
  console.log("Summary:");
  console.log(`  - Token ID: ${tokenId}`);
  console.log(`  - Removed from collection: ${COLLECTION_PROGRAM}`);
  console.log(`  - Network: ${NETWORK}`);
} catch (error) {
  console.error("\n❌ Error burning NFT:", error.message);
  process.exit(1);
}
