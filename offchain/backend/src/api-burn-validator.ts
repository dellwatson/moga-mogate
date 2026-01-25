/**
 * REST API endpoints for NFT burn validation
 *
 * Endpoints:
 * - POST /api/casper/validate-burn - Validate a single burn tx
 * - POST /api/casper/validate-burns - Batch validate burns
 * - GET /api/casper/burn/:hash - Get burn details
 */

import {
  testnetBurnValidator,
  mainnetBurnValidator,
} from "./casper-nft-validator";
import type { Request, Response } from "express";

/**
 * POST /api/casper/validate-burn
 *
 * Body:
 * {
 *   "burnTxHash": "abc123...",
 *   "network": "testnet" | "mainnet"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "deployHash": "...",
 *     "collection": { ... },
 *     "nft": {
 *       "tokenId": "...",
 *       "metadataUri": "...",
 *       "lastOwner": "account-hash-..."
 *     },
 *     "burner": "account-hash-...",
 *     "timestamp": "..."
 *   }
 * }
 */
export async function validateBurnEndpoint(req: Request, res: Response) {
  try {
    const { burnTxHash, network = "testnet" } = req.body;

    if (!burnTxHash) {
      return res.status(400).json({
        success: false,
        error: "burnTxHash is required",
      });
    }

    const validator =
      network === "mainnet" ? mainnetBurnValidator : testnetBurnValidator;
    const result = await validator.validateBurn(burnTxHash);

    if (result.valid && result.data) {
      return res.json({
        success: true,
        data: {
          deployHash: result.data.deployHash,
          blockHash: result.data.blockHash,
          timestamp: result.data.timestamp,
          burner: result.data.burner,
          collection: {
            contractHash: result.data.collection.contractHash,
            packageHash: result.data.collection.contractPackageHash,
            name: result.data.collection.name,
            symbol: result.data.collection.symbol,
          },
          nft: {
            tokenId: result.data.nft.tokenId,
            metadataUri: result.data.nft.metadataUri,
            lastOwner: result.data.nft.lastOwner,
            burnedAt: result.data.nft.burnedAt,
          },
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || "Validation failed",
      });
    }
  } catch (error: any) {
    console.error("Burn validation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/casper/validate-burns
 *
 * Body:
 * {
 *   "burnTxHashes": ["abc123...", "def456..."],
 *   "network": "testnet" | "mainnet"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "results": [
 *     { "valid": true, "data": { ... } },
 *     { "valid": false, "error": "..." }
 *   ]
 * }
 */
export async function validateBurnsEndpoint(req: Request, res: Response) {
  try {
    const { burnTxHashes, network = "testnet" } = req.body;

    if (!Array.isArray(burnTxHashes) || burnTxHashes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "burnTxHashes array is required",
      });
    }

    if (burnTxHashes.length > 100) {
      return res.status(400).json({
        success: false,
        error: "Maximum 100 burns per request",
      });
    }

    const validator =
      network === "mainnet" ? mainnetBurnValidator : testnetBurnValidator;
    const results = await validator.validateBurns(burnTxHashes);

    return res.json({
      success: true,
      results: results.map((r) => ({
        valid: r.valid,
        error: r.error,
        data: r.data
          ? {
              deployHash: r.data.deployHash,
              nft: {
                tokenId: r.data.nft.tokenId,
                metadataUri: r.data.nft.metadataUri,
                lastOwner: r.data.nft.lastOwner,
              },
              burner: r.data.burner,
            }
          : undefined,
      })),
    });
  } catch (error: any) {
    console.error("Batch validation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * GET /api/casper/burn/:hash
 *
 * Query params:
 * - network: "testnet" | "mainnet"
 *
 * Response: Same as validate-burn
 */
export async function getBurnDetailsEndpoint(req: Request, res: Response) {
  try {
    const { hash } = req.params;
    const network = (req.query.network as string) || "testnet";

    if (!hash) {
      return res.status(400).json({
        success: false,
        error: "Burn hash is required",
      });
    }

    const validator =
      network === "mainnet" ? mainnetBurnValidator : testnetBurnValidator;
    const result = await validator.validateBurn(hash);

    if (result.valid && result.data) {
      return res.json({
        success: true,
        data: result.data,
      });
    } else {
      return res.status(404).json({
        success: false,
        error: result.error || "Burn not found or invalid",
      });
    }
  } catch (error: any) {
    console.error("Get burn details error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/casper/check-burn
 *
 * Quick check if a deploy is a burn transaction (lightweight)
 *
 * Body:
 * {
 *   "deployHash": "abc123...",
 *   "network": "testnet" | "mainnet"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "isBurn": true
 * }
 */
export async function checkBurnEndpoint(req: Request, res: Response) {
  try {
    const { deployHash, network = "testnet" } = req.body;

    if (!deployHash) {
      return res.status(400).json({
        success: false,
        error: "deployHash is required",
      });
    }

    const validator =
      network === "mainnet" ? mainnetBurnValidator : testnetBurnValidator;
    const isBurn = await validator.isBurnTransaction(deployHash);

    return res.json({
      success: true,
      isBurn,
    });
  } catch (error: any) {
    console.error("Check burn error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

// Express router setup
export function setupBurnValidatorRoutes(app: any) {
  app.post("/api/casper/validate-burn", validateBurnEndpoint);
  app.post("/api/casper/validate-burns", validateBurnsEndpoint);
  app.get("/api/casper/burn/:hash", getBurnDetailsEndpoint);
  app.post("/api/casper/check-burn", checkBurnEndpoint);
}
