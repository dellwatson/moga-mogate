import { Connection, PublicKey } from "@solana/web3.js";
import {
  deserializeMetadata,
  findMetadataPda as findMetadataPdaMpl,
} from "@metaplex-foundation/mpl-token-metadata";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Cache collection size checks to avoid repeated RPC calls
const collectionSizeCache = new Map<string, boolean>();

/**
 * Derive the metadata PDA for a mint
 */
export function findMetadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

/**
 * Check if a collection has a size set (is a sized collection)
 * @param connection - Solana connection
 * @param collectionMint - Collection mint address
 * @returns true if collection has size, false otherwise
 */
export async function isCollectionSized(
  connection: Connection,
  collectionMint: PublicKey
): Promise<boolean> {
  const cacheKey = collectionMint.toBase58();

  // Check cache first
  if (collectionSizeCache.has(cacheKey)) {
    const cached = collectionSizeCache.get(cacheKey)!;
    console.log(
      `📦 Using cached result for ${cacheKey}: ${cached ? "SIZED" : "UNSIZED"}`
    );
    return cached;
  }

  try {
    const metadataPda = findMetadataPda(collectionMint);
    const accountInfo = await connection.getAccountInfo(metadataPda);

    if (!accountInfo) {
      console.warn("Collection metadata not found");
      return false;
    }

    // Deserialize metadata account
    const metadata = deserializeMetadata(accountInfo);

    // Check if collectionDetails exists (indicates sized collection)
    const isSized =
      metadata.collectionDetails !== null &&
      metadata.collectionDetails !== undefined;

    console.log(
      `Collection ${collectionMint.toBase58()} is ${
        isSized ? "SIZED" : "UNSIZED"
      }${
        isSized && metadata.collectionDetails
          ? ` (${
              metadata.collectionDetails.__kind === "V1"
                ? metadata.collectionDetails.size
                : "unknown"
            } items)`
          : ""
      }`
    );

    // Cache the result
    collectionSizeCache.set(cacheKey, isSized);

    return isSized;
  } catch (error) {
    console.error("Error checking collection size:", error);
    // Default to sized for safety (your current collection is sized)
    return true;
  }
}
