/**
 * Backend API for issuing NFT mint permits
 *
 * Endpoints:
 * - POST /api/casper/request-mint-permit - Request a signed permit to mint NFT
 * - POST /api/casper/verify-permit - Verify a permit signature
 */

import {
  CasperPermitSigner,
  loadPermitSignerFromEnv,
  type SignedPermit,
} from "../../../ts-sdk/src/casper-permit-signer";
import type { Request, Response } from "express";

// Singleton permit signer (loaded from env)
let permitSigner: CasperPermitSigner | null = null;

function getPermitSigner(): CasperPermitSigner {
  if (!permitSigner) {
    permitSigner = loadPermitSignerFromEnv();
  }
  return permitSigner;
}

/**
 * POST /api/casper/request-mint-permit
 *
 * Request a signed permit to mint an NFT
 *
 * Body:
 * {
 *   "collectionHash": "376fb8f9264fd7cf...",
 *   "recipientAccountHash": "1877cb2417eb4f7f...",
 *   "metadata": {
 *     "name": "Tixia $100 Flight Credit",
 *     "token_uri": "https://..."
 *   },
 *   "validitySeconds": 3600  // optional, default 1 hour
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "permit": {
 *     "collection_hash": "...",
 *     "token_owner": "account-hash-...",
 *     "token_metadata": "{...}",
 *     "nonce": "...",
 *     "expiry": 1234567890,
 *     "signature": "abc123..."
 *   }
 * }
 */
export async function requestMintPermitEndpoint(req: Request, res: Response) {
  try {
    const { collectionHash, recipientAccountHash, metadata, validitySeconds } =
      req.body;

    // Validate inputs
    if (!collectionHash || !/^[0-9a-fA-F]{64}$/.test(collectionHash)) {
      return res.status(400).json({
        success: false,
        error: "Invalid collectionHash (must be 64-char hex)",
      });
    }

    if (
      !recipientAccountHash ||
      !/^[0-9a-fA-F]{64}$/.test(recipientAccountHash)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid recipientAccountHash (must be 64-char hex)",
      });
    }

    if (!metadata || !metadata.name || !metadata.token_uri) {
      return res.status(400).json({
        success: false,
        error: "Invalid metadata (must have name and token_uri)",
      });
    }

    // Optional: Add business logic here
    // - Check if user is eligible to mint
    // - Check if collection has remaining supply
    // - Check if user has already minted
    // - Rate limiting
    // - etc.

    // Create and sign permit
    const signer = getPermitSigner();
    const permit = signer.createMintPermit(
      collectionHash,
      recipientAccountHash,
      metadata,
      validitySeconds
    );

    return res.json({
      success: true,
      permit,
    });
  } catch (error: any) {
    console.error("Request mint permit error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/casper/verify-permit
 *
 * Verify a permit signature (for testing/debugging)
 *
 * Body:
 * {
 *   "permit": {
 *     "collection_hash": "...",
 *     "token_owner": "...",
 *     "token_metadata": "...",
 *     "nonce": "...",
 *     "expiry": 1234567890,
 *     "signature": "..."
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "valid": true,
 *   "expired": false
 * }
 */
export async function verifyPermitEndpoint(req: Request, res: Response) {
  try {
    const { permit } = req.body;

    if (!permit) {
      return res.status(400).json({
        success: false,
        error: "Permit is required",
      });
    }

    const signer = getPermitSigner();
    const valid = signer.verifyPermit(permit as SignedPermit);

    const now = Math.floor(Date.now() / 1000);
    const expired = permit.expiry < now;

    return res.json({
      success: true,
      valid,
      expired,
      expiresIn: expired ? 0 : permit.expiry - now,
    });
  } catch (error: any) {
    console.error("Verify permit error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * GET /api/casper/authority-public-key
 *
 * Get the authority's public key (for contract initialization)
 *
 * Response:
 * {
 *   "success": true,
 *   "publicKey": "020363fc89757f974d8d08d8f61ffe805108e2bfc938234d841fd8101e4a08d6e257"
 * }
 */
export async function getAuthorityPublicKeyEndpoint(
  req: Request,
  res: Response
) {
  try {
    const signer = getPermitSigner();
    const publicKey = signer.getAuthorityPublicKey();

    return res.json({
      success: true,
      publicKey: publicKey.toHex(),
      accountHash: publicKey.toAccountHashStr(),
    });
  } catch (error: any) {
    console.error("Get authority public key error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * Setup permit API routes
 */
export function setupPermitRoutes(app: any) {
  app.post("/api/casper/request-mint-permit", requestMintPermitEndpoint);
  app.post("/api/casper/verify-permit", verifyPermitEndpoint);
  app.get("/api/casper/authority-public-key", getAuthorityPublicKeyEndpoint);
}
