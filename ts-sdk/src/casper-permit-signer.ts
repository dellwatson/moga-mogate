/**
 * Casper Permit Signer
 *
 * Creates and signs permits for NFT minting via authority_mint_permit contract.
 */

import { Keys, CLPublicKey } from "casper-js-sdk";
import crypto from "crypto";

export interface MintPermit {
  collection_hash: string;
  token_owner: string;
  token_metadata: string;
  nonce: string;
  expiry: number;
}

export interface SignedPermit extends MintPermit {
  signature: string; // hex-encoded signature
}

export class CasperPermitSigner {
  private authorityKeys: Keys.AsymmetricKey;

  constructor(authorityKeys: Keys.AsymmetricKey) {
    this.authorityKeys = authorityKeys;
  }

  /**
   * Create a canonical JSON message for signing
   * Must match the format in the contract's create_permit_message function
   */
  private createCanonicalMessage(permit: MintPermit): string {
    // Sort keys alphabetically for canonical representation
    const canonical = {
      collection_hash: permit.collection_hash,
      expiry: permit.expiry,
      nonce: permit.nonce,
      token_metadata: permit.token_metadata,
      token_owner: permit.token_owner,
    };

    return JSON.stringify(canonical);
  }

  /**
   * Sign a mint permit
   *
   * @param permit - The mint permit to sign
   * @returns Signed permit with signature
   */
  signPermit(permit: MintPermit): SignedPermit {
    const message = this.createCanonicalMessage(permit);
    const messageBytes = Buffer.from(message, "utf-8");

    // Hash with Blake2b-512 (same as contract)
    const hash = crypto.createHash("blake2b512").update(messageBytes).digest();

    // Sign with authority's private key
    const signature = this.authorityKeys.sign(hash);

    return {
      ...permit,
      signature: Buffer.from(signature).toString("hex"),
    };
  }

  /**
   * Create and sign a mint permit
   *
   * @param collectionHash - Collection contract hash (64-char hex, no prefix)
   * @param recipientAccountHash - Recipient account hash (64-char hex, no prefix)
   * @param metadata - NFT metadata object
   * @param validitySeconds - How long the permit is valid (default: 1 hour)
   * @returns Signed permit
   */
  createMintPermit(
    collectionHash: string,
    recipientAccountHash: string,
    metadata: { name: string; token_uri: string },
    validitySeconds: number = 3600
  ): SignedPermit {
    const nonce = this.generateNonce();
    const expiry = Math.floor(Date.now() / 1000) + validitySeconds;

    const permit: MintPermit = {
      collection_hash: collectionHash,
      token_owner: `account-hash-${recipientAccountHash}`,
      token_metadata: JSON.stringify(metadata),
      nonce,
      expiry,
    };

    return this.signPermit(permit);
  }

  /**
   * Generate a unique nonce
   */
  private generateNonce(): string {
    return `${Date.now()}-${crypto.randomBytes(16).toString("hex")}`;
  }

  /**
   * Verify a permit signature (for testing)
   */
  verifyPermit(signedPermit: SignedPermit): boolean {
    const message = this.createCanonicalMessage(signedPermit);
    const messageBytes = Buffer.from(message, "utf-8");
    const hash = crypto.createHash("blake2b512").update(messageBytes).digest();

    const signature = Buffer.from(signedPermit.signature, "hex");

    return this.authorityKeys.verify(hash, signature);
  }

  /**
   * Get authority public key (for contract initialization)
   */
  getAuthorityPublicKey(): CLPublicKey {
    return this.authorityKeys.publicKey;
  }
}

/**
 * Load permit signer from PEM files
 */
export function loadPermitSigner(
  publicKeyPath: string,
  privateKeyPath: string
): CasperPermitSigner {
  const keys = Keys.Ed25519.parseKeyFiles(publicKeyPath, privateKeyPath);
  return new CasperPermitSigner(keys);
}

/**
 * Create permit signer from environment variables
 */
export function loadPermitSignerFromEnv(): CasperPermitSigner {
  const publicKeyPath =
    process.env.AUTHORITY_PUBLIC_KEY_PATH || "./authority_public_key.pem";
  const privateKeyPath =
    process.env.AUTHORITY_SECRET_KEY_PATH || "./authority_secret_key.pem";

  return loadPermitSigner(publicKeyPath, privateKeyPath);
}
