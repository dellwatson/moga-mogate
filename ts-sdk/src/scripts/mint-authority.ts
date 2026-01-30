#!/usr/bin/env bun
// Mint NFT through Authority Gateway (Owner Only)

import { createClient } from "../client.js";
import { getPrivateKey } from "../config.js";

async function main(
  toAddressParam?: string,
  uriHashParam?: string,
  tokenIdParam?: string,
) {
  // Parse arguments - prioritize function params, then CLI args, then env/defaults
  const toAddress =
    toAddressParam || process.argv[2] || process.env.PRIVATE_KEY;
  const uriHash = uriHashParam || process.argv[3] || "123456789field";
  const tokenId = tokenIdParam || process.argv[4] || "1u64";

  if (!toAddress) {
    console.error("❌ Error: No address provided and PRIVATE_KEY not set");
    process.exit(1);
  }

  console.log("🎨 Minting NFT through Authority Gateway (Owner Only)");
  console.log("==================================================");
  console.log(`To Address:  ${toAddress}`);
  console.log(`URI Hash:    ${uriHash}`);
  console.log(`Token ID:    ${tokenId}`);
  console.log("");

  try {
    // Create client
    const client = createClient();
    console.log(`📍 Your address: ${client.getAddress()}`);

    // Check balance
    const balance = await client.getBalance();
    console.log(`💰 Balance: ${balance} credits`);
    console.log("");

    // Execute mint (local, not broadcast)
    console.log("⚙️  Creating mint transaction...");
    const result = await client.mintAuthority(toAddress, uriHash, tokenId);

    console.log("");
    console.log("✅ Mint transaction created!");
    console.log("");
    console.log("Transaction:", result);
    console.log("");
    console.log("⚠️  Note: This was a local execution (dry-run)");
    console.log(
      "To broadcast to network, use the Leo CLI with --broadcast flag",
    );
  } catch (error) {
    console.error("");
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { main };
