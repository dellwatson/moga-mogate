#!/usr/bin/env bun
/**
 * Initialize Authority Gateway (Set Owner)
 *
 * This MUST be called before any minting operations
 */

import { $ } from "bun";

// Your address (will become the gateway owner)
const OWNER_ADDRESS =
  "aleo1yv0wuzhwr68dkstlcl4keu4j6s0d3fzhqz0fzge6fz4w3wjwmq9s6jza3u";

console.log("🔧 Initializing Authority Gateway");
console.log("===============================");
console.log(`📍 Gateway: mogate_authority_mint_gateway.aleo`);
console.log(`📍 Owner: ${OWNER_ADDRESS}`);
console.log("");

try {
  console.log("📡 Broadcasting initialization transaction...");
  console.log("");

  const result =
    await $`cd programs/authority_mint_gateway && leo execute initialize ${OWNER_ADDRESS} --broadcast https://api.provable.com/v2/testnet/transaction/broadcast`;

  console.log("");
  console.log("✅ Gateway initialized successfully!");
  console.log("");
  console.log(result.stdout.toString());
} catch (error) {
  console.error("");
  console.error("❌ Error:", error.message);
  console.error("");
  console.error("Note: Only the deployer can initialize the gateway!");
  process.exit(1);
}
