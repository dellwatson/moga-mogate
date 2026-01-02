#!/usr/bin/env bun
/**
 * Mint NFT via Authority Mint Contract
 *
 * Usage:
 *   bun run scripts/casper/mint-nft.ts
 */

import {
  CasperAuthorityMintClient,
  TIXIA_1O1_COLLECTION_HASH,
} from "../../ts-sdk/src/casper-authority-mint";
import { Keys } from "casper-js-sdk";

async function main() {
  // Load keys
  const keys = Keys.Ed25519.parseKeyFiles(
    "./Account 1_public_key.pem",
    "./Account 1_secret_key.pem"
  );

  const client = new CasperAuthorityMintClient();

  // Get recipient from args or use deployer
  const recipientAccountHash =
    process.argv[2] ||
    keys.publicKey.toAccountHashStr().replace("account-hash-", "");

  console.log("🎫 Minting NFT...");
  console.log("   Collection:", TIXIA_1O1_COLLECTION_HASH);
  console.log("   Recipient:", recipientAccountHash);

  const deployHash = await client.mintNFT(
    {
      collectionHash: TIXIA_1O1_COLLECTION_HASH,
      recipientAccountHash,
      metadata: {
        name: "Tixia $100 Flight Credit",
        token_uri:
          "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/100/metadata.json",
      },
    },
    keys
  );

  console.log("\n✅ Deploy submitted!");
  console.log("   Deploy Hash:", deployHash);
  console.log("   Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  console.log("\n⏳ Waiting for execution...");
  const result = await client.waitForDeploy(deployHash);

  if (result.success) {
    console.log("✅ NFT minted successfully!");
  } else {
    console.error("❌ Mint failed:", result.error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
