#!/usr/bin/env node
/**
 * Mint NFT through Authority Gateway V2 (PUBLIC)
 *
 * Example implementation using TS SDK - Frontend compatible
 */

import { createClient } from "../ts-sdk/dist/index.js";

// ============================================
// CONFIGURATION
// ============================================

const TO_ADDRESS =
  "aleo1yv0wuzhwr68dkstlcl4keu4j6s0d3fzhqz0fzge6fz4w3wjwmq9s6jza3u";
const URI_HASH = "123456789";
const TOKEN_ID = `${Date.now()}`;

console.log("🎨 Minting NFT through Authority Gateway V2");
console.log("============================================");
console.log(`📍 To: ${TO_ADDRESS}`);
console.log(`📍 URI Hash: ${URI_HASH}`);
console.log(`📍 Token ID: ${TOKEN_ID}`);
console.log("");

async function mint() {
  try {
    // Create Aleo client from TS SDK
    const client = createClient();
    console.log(`📍 Your address: ${client.getAddress()}`);

    // Check balance
    const balance = await client.getBalance();
    console.log(`💰 Balance: ${balance} credits`);
    console.log("");

    // Execute mint through gateway
    console.log("⚙️  Creating mint transaction...");
    const result = await client.mintAuthority(TO_ADDRESS, URI_HASH, TOKEN_ID);

    console.log("");
    console.log("✅ Mint transaction created!");
    console.log("");
    console.log("Transaction:", result);
    console.log("");
    console.log("⚠️  Note: This was a local execution (dry-run)");
    console.log("To broadcast to network, use Leo CLI with --broadcast flag");
  } catch (error) {
    console.error("");
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

mint();
