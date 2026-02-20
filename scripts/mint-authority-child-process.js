#!/usr/bin/env node
/**
 * Legacy wrapper kept for compatibility.
 * It now forwards to the root faucet script.
 */

import { spawn } from "child_process";

// ============================================
// CONFIGURATION
// ============================================

const TO_ADDRESS =
  "aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2";
const DATA_FILE = "scripts/mint_private.sample_data.leo";
const EDITION = "1";

console.log("🎨 Minting NFT through Authority Gateway");
console.log("========================================");
console.log(`📍 To: ${TO_ADDRESS}`);
console.log(`📍 Data file: ${DATA_FILE}`);
console.log(`📍 Edition: ${EDITION}`);
console.log("");

// Forward to root script (which uses ts-sdk module).
const tsScript = spawn(
  "bun",
  [
    "run",
    "scripts/01_mint_private_gateway.ts",
    "--to",
    TO_ADDRESS,
    "--data-file",
    DATA_FILE,
    "--edition",
    EDITION,
  ],
  {
    stdio: "inherit",
    shell: true,
  },
);

tsScript.on("close", (code) => {
  process.exit(code);
});
