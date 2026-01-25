/**
 * Backend API for signing data with Ed25519
 *
 * Endpoints:
 * - POST /api/casper/sign-data - Sign arbitrary data
 * - POST /api/casper/verify-signature - Verify a signature
 * - GET /api/casper/signer-public-key - Get signer's public key
 *
 * Use Case:
 * Backend holds the private key and signs data on behalf of users.
 * Users submit the signed data to the contract for verification.
 */

import {
  CasperSignatureService,
  loadSignatureServiceFromEnv,
  type SignedData,
} from "../../../ts-sdk/src/casper-signature-service";
import type { Request, Response } from "express";

// Singleton signature service (loaded from env)
let signatureService: CasperSignatureService | null = null;

function getSignatureService(): CasperSignatureService {
  if (!signatureService) {
    signatureService = loadSignatureServiceFromEnv();
  }
  return signatureService;
}

/**
 * POST /api/casper/sign-data
 *
 * Sign arbitrary data with the backend's private key
 *
 * Body:
 * {
 *   "value": "Hello, Casper!",
 *   "nonce": "optional-custom-nonce"  // optional, auto-generated if not provided
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "signedData": {
 *     "value": "Hello, Casper!",
 *     "nonce": "1234567890-abc...",
 *     "signature": "def..."
 *   }
 * }
 */
export async function signDataEndpoint(req: Request, res: Response) {
  try {
    const { value, nonce } = req.body;

    // Validate input
    if (!value || typeof value !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid value (must be a non-empty string)",
      });
    }

    // Optional: Add business logic here
    // - Rate limiting
    // - User authentication
    // - Authorization checks
    // - Logging
    // - etc.

    // Sign the data
    const signer = getSignatureService();
    const signedData = nonce
      ? signer.signData(value, nonce)
      : signer.signDataWithNonce(value);

    return res.json({
      success: true,
      signedData,
    });
  } catch (error: any) {
    console.error("Sign data error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/casper/verify-signature
 *
 * Verify a signature (for testing/debugging)
 *
 * Body:
 * {
 *   "signedData": {
 *     "value": "...",
 *     "nonce": "...",
 *     "signature": "..."
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "valid": true
 * }
 */
export async function verifySignatureEndpoint(req: Request, res: Response) {
  try {
    const { signedData } = req.body;

    if (!signedData) {
      return res.status(400).json({
        success: false,
        error: "signedData is required",
      });
    }

    const signer = getSignatureService();
    const valid = signer.verifySignature(signedData as SignedData);

    return res.json({
      success: true,
      valid,
    });
  } catch (error: any) {
    console.error("Verify signature error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * GET /api/casper/signer-public-key
 *
 * Get the signer's public key (for contract initialization)
 *
 * Response:
 * {
 *   "success": true,
 *   "publicKey": "020363fc89757f974d8d08d8f61ffe805108e2bfc938234d841fd8101e4a08d6e257",
 *   "accountHash": "account-hash-..."
 * }
 */
export async function getSignerPublicKeyEndpoint(req: Request, res: Response) {
  try {
    const signer = getSignatureService();
    const publicKey = signer.getPublicKey();

    return res.json({
      success: true,
      publicKey: publicKey.toHex(),
      accountHash: publicKey.toAccountHashStr(),
    });
  } catch (error: any) {
    console.error("Get signer public key error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/casper/sign-structured-data
 *
 * Sign structured data (EIP-712 style)
 *
 * Body:
 * {
 *   "data": {
 *     "action": "transfer",
 *     "recipient": "account-hash-...",
 *     "amount": 1000,
 *     "deadline": 1234567890
 *   },
 *   "nonce": "optional-custom-nonce"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "signedData": {
 *     "value": "{\"action\":\"transfer\",...}",
 *     "nonce": "...",
 *     "signature": "..."
 *   }
 * }
 */
export async function signStructuredDataEndpoint(req: Request, res: Response) {
  try {
    const { data, nonce } = req.body;

    if (!data || typeof data !== "object") {
      return res.status(400).json({
        success: false,
        error: "Invalid data (must be an object)",
      });
    }

    // Create canonical JSON (sorted keys)
    const sortedKeys = Object.keys(data).sort();
    const canonical: any = {};
    for (const key of sortedKeys) {
      canonical[key] = data[key];
    }

    const jsonString = JSON.stringify(canonical);

    // Sign the canonical JSON
    const signer = getSignatureService();
    const signedData = nonce
      ? signer.signData(jsonString, nonce)
      : signer.signDataWithNonce(jsonString);

    return res.json({
      success: true,
      signedData,
      originalData: data,
    });
  } catch (error: any) {
    console.error("Sign structured data error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * Setup signature API routes
 */
export function setupSignatureRoutes(app: any) {
  app.post("/api/casper/sign-data", signDataEndpoint);
  app.post("/api/casper/verify-signature", verifySignatureEndpoint);
  app.get("/api/casper/signer-public-key", getSignerPublicKeyEndpoint);
  app.post("/api/casper/sign-structured-data", signStructuredDataEndpoint);
}
