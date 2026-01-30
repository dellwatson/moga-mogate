#!/usr/bin/env node
/**
 * Mint NFT through Authority Gateway V2 (PUBLIC)
 *
 * Wrapper script that calls the TS SDK mint function using tsx
 */

import { spawn } from "child_process";

// ============================================
// CONFIGURATION
// ============================================

const TO_ADDRESS =
  "aleo1yv0wuzhwr68dkstlcl4keu4j6s0d3fzhqz0fzge6fz4w3wjwmq9s6jza3u";
const URI_HASH = "123456789field";
const TOKEN_ID = `${Date.now()}u64`;

console.log("🎨 Minting NFT through Authority Gateway V2");
console.log("============================================");
console.log(`📍 To: ${TO_ADDRESS}`);
console.log(`📍 URI Hash: ${URI_HASH}`);
console.log(`📍 Token ID: ${TOKEN_ID}`);
console.log("");

// Call the TS SDK mint function using tsx
const tsScript = spawn(
  "npx",
  [
    "tsx",
    "ts-sdk/src/scripts/mint-authority.ts",
    TO_ADDRESS,
    URI_HASH,
    TOKEN_ID,
  ],
  {
    stdio: "inherit",
    shell: true,
  },
);

tsScript.on("close", (code) => {
  process.exit(code);
});
