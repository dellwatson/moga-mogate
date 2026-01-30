#!/usr/bin/env bun
// Mint NFT through Faucet (Public Access)

import { createClient } from "../client.js";

async function main(toAddressParam?: string, uriHashParam?: string) {
  // Parse arguments - prioritize function params, then CLI args, then env/defaults
  const toAddress =
    toAddressParam || process.argv[2] || process.env.PRIVATE_KEY;
  const uriHash = uriHashParam || process.argv[3] || "123456789field";

  if (!toAddress) {
    console.error("❌ Error: No address provided and PRIVATE_KEY not set");
    process.exit(1);
  }

  console.log("🎁 Minting NFT through Faucet (Public Access)");
  console.log("==============================================");
  console.log(`To Address:  ${toAddress}`);
  console.log(`URI Hash:    ${uriHash}`);
  console.log(`Token ID:    Auto-increment`);
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
    console.log("⚙️  Creating faucet mint transaction...");
    const result = await client.mintFaucet(toAddress, uriHash);

    console.log("");
    console.log("✅ Faucet mint transaction created!");
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
if ((import.meta as any).main) {
  main();
}

export { main };
