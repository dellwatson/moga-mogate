#!/usr/bin/env bun
/**
 * Validate NFT Burn Transaction
 *
 * Usage:
 *   bun run scripts/casper/validate-burn.ts <BURN_TX_HASH>
 */

import { testnetBurnValidator } from "../../offchain/backend/src/casper-nft-validator";

async function main() {
  const burnTxHash = process.argv[2];

  if (!burnTxHash) {
    console.error(
      "Usage: bun run scripts/casper/validate-burn.ts <BURN_TX_HASH>"
    );
    process.exit(1);
  }

  console.log("🔍 Validating burn transaction...");
  console.log("   Tx Hash:", burnTxHash);

  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (result.valid && result.data) {
    console.log("\n✅ Valid burn transaction!");
    console.log("\n📦 Collection:");
    console.log("   Contract:", result.data.collection.contractHash);
    console.log("   Name:", result.data.collection.name || "N/A");
    console.log("   Symbol:", result.data.collection.symbol || "N/A");

    console.log("\n🎫 NFT:");
    console.log("   Token ID:", result.data.nft.tokenId);
    console.log("   Metadata URI:", result.data.nft.metadataUri);
    console.log("   Last Owner:", result.data.nft.lastOwner);
    console.log("   Burned At:", result.data.nft.burnedAt);

    console.log("\n🔥 Burn Info:");
    console.log("   Burner:", result.data.burner);
    console.log("   Block:", result.data.blockHash);
    console.log("   Timestamp:", result.data.timestamp);

    // Fetch metadata
    if (result.data.nft.metadataUri) {
      console.log("\n📄 Fetching metadata...");
      try {
        const response = await fetch(result.data.nft.metadataUri);
        const metadata = await response.json();
        console.log("   Name:", metadata.name);
        console.log("   Description:", metadata.description);
        console.log("   Image:", metadata.image);
        if (metadata.attributes) {
          console.log("   Attributes:", metadata.attributes);
        }
      } catch (error) {
        console.warn("   Could not fetch metadata:", error);
      }
    }
  } else {
    console.error("\n❌ Invalid burn:", result.error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
