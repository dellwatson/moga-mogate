#!/usr/bin/env node
/**
 * Mint API Server - Backend service for minting NFTs
 *
 * This wraps Leo CLI and exposes REST API for frontend
 * Run: node scripts/mint-api.js
 */

import express from "express";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const app = express();
app.use(express.json());

const PORT = 3001;
const GATEWAY_DIR = "./programs/authority_mint_gateway";

/**
 * POST /mint
 * Body: { toAddress, uriHash, tokenId }
 */
app.post("/mint", async (req, res) => {
  try {
    const { toAddress, uriHash, tokenId } = req.body;

    if (!toAddress || !uriHash) {
      return res.status(400).json({
        error: "Missing required fields: toAddress, uriHash",
      });
    }

    const finalTokenId = tokenId || `${Date.now()}u64`;

    console.log("🎨 Minting NFT...");
    console.log("To:", toAddress);
    console.log("URI Hash:", uriHash);
    console.log("Token ID:", finalTokenId);

    // Execute Leo CLI
    const command = `cd ${GATEWAY_DIR} && leo execute mint ${toAddress} ${uriHash} ${finalTokenId} --network testnet --broadcast https://api.provable.com/v2/testnet/transaction/broadcast`;

    const { stdout, stderr } = await execAsync(command);

    // Parse transaction ID from output
    const txMatch = stdout.match(/transaction ID: '([^']+)'/);
    const transactionId = txMatch ? txMatch[1] : null;

    console.log("✅ Mint successful!");
    console.log("TX ID:", transactionId);

    res.json({
      success: true,
      transactionId,
      toAddress,
      uriHash,
      tokenId: finalTokenId,
      output: stdout,
    });
  } catch (error) {
    console.error("❌ Mint failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr,
    });
  }
});

/**
 * GET /health
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "aleo-mint-api" });
});

app.listen(PORT, () => {
  console.log(`🚀 Mint API running on http://localhost:${PORT}`);
  console.log("");
  console.log("Endpoints:");
  console.log(`  POST http://localhost:${PORT}/mint`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log("");
  console.log("Example:");
  console.log(`  curl -X POST http://localhost:${PORT}/mint \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"toAddress":"aleo1...", "uriHash":"123456789field"}'`);
});
