/**
 * Example usage of Casper NFT Burn Validator
 */

import {
  CasperNFTBurnValidator,
  testnetBurnValidator,
} from "./casper-nft-validator";

// Example 1: Validate a single burn transaction
async function validateSingleBurn() {
  const burnTxHash = "abc123..."; // Replace with actual burn tx hash

  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (result.valid && result.data) {
    console.log("✅ Valid burn transaction!");
    console.log("\n📦 Collection:");
    console.log("  Contract:", result.data.collection.contractHash);
    console.log("  Name:", result.data.collection.name);
    console.log("  Symbol:", result.data.collection.symbol);

    console.log("\n🎫 NFT:");
    console.log("  Token ID:", result.data.nft.tokenId);
    console.log("  Metadata URI:", result.data.nft.metadataUri);
    console.log("  Last Owner:", result.data.nft.lastOwner);
    console.log("  Burned At:", result.data.nft.burnedAt);

    console.log("\n🔥 Burn Info:");
    console.log("  Burner:", result.data.burner);
    console.log("  Block:", result.data.blockHash);
    console.log("  Deploy:", result.data.deployHash);
  } else {
    console.error("❌ Invalid burn:", result.error);
  }
}

// Example 2: Batch validate multiple burns
async function validateMultipleBurns() {
  const burnHashes = ["abc123...", "def456...", "ghi789..."];

  const results = await testnetBurnValidator.validateBurns(burnHashes);

  console.log(`Validated ${results.length} burns:`);
  results.forEach((result, index) => {
    if (result.valid) {
      console.log(`✅ Burn ${index + 1}: Valid`);
      console.log(`   Metadata: ${result.data?.nft.metadataUri}`);
      console.log(`   Owner: ${result.data?.nft.lastOwner}`);
    } else {
      console.log(`❌ Burn ${index + 1}: ${result.error}`);
    }
  });
}

// Example 3: Quick check if deploy is a burn
async function checkIfBurn() {
  const deployHash = "abc123...";
  const isBurn = await testnetBurnValidator.isBurnTransaction(deployHash);

  console.log(
    `Deploy ${deployHash} is ${isBurn ? "a burn" : "not a burn"} transaction`
  );
}

// Example 4: API endpoint for burn validation
export async function validateBurnAPI(req: any, res: any) {
  const { burnTxHash } = req.body;

  if (!burnTxHash) {
    return res.status(400).json({ error: "burnTxHash required" });
  }

  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (result.valid) {
    return res.json({
      success: true,
      burn: {
        deployHash: result.data!.deployHash,
        collection: result.data!.collection,
        nft: result.data!.nft,
        burner: result.data!.burner,
        timestamp: result.data!.timestamp,
      },
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error,
    });
  }
}

// Example 5: Validate and store in database
async function validateAndStore(burnTxHash: string, db: any) {
  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (!result.valid || !result.data) {
    throw new Error(`Invalid burn: ${result.error}`);
  }

  // Store in database
  await db.burns.create({
    deployHash: result.data.deployHash,
    blockHash: result.data.blockHash,
    timestamp: new Date(result.data.timestamp),
    burner: result.data.burner,
    collectionHash: result.data.collection.contractHash,
    collectionName: result.data.collection.name,
    tokenId: result.data.nft.tokenId,
    metadataUri: result.data.nft.metadataUri,
    lastOwner: result.data.nft.lastOwner,
    burnedAt: new Date(result.data.nft.burnedAt),
  });

  console.log("✅ Burn validated and stored in database");
  return result.data;
}

// Example 6: Validate burn for raffle entry
async function validateBurnForRaffle(
  burnTxHash: string,
  expectedCollection: string
) {
  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (!result.valid || !result.data) {
    throw new Error(`Invalid burn: ${result.error}`);
  }

  // Check if burn is from expected collection
  if (result.data.collection.contractHash !== expectedCollection) {
    throw new Error(
      `Wrong collection. Expected ${expectedCollection}, got ${result.data.collection.contractHash}`
    );
  }

  // Check if burn is recent (within last 24 hours)
  const burnTime = new Date(result.data.nft.burnedAt).getTime();
  const now = Date.now();
  const hoursSinceBurn = (now - burnTime) / (1000 * 60 * 60);

  if (hoursSinceBurn > 24) {
    throw new Error(`Burn too old: ${hoursSinceBurn.toFixed(1)} hours ago`);
  }

  console.log("✅ Valid burn for raffle entry!");
  return {
    tokenId: result.data.nft.tokenId,
    metadataUri: result.data.nft.metadataUri,
    owner: result.data.nft.lastOwner,
    burner: result.data.burner,
  };
}

// Example 7: Extract metadata from URI
async function extractMetadataFromBurn(burnTxHash: string) {
  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (!result.valid || !result.data) {
    throw new Error(`Invalid burn: ${result.error}`);
  }

  const metadataUri = result.data.nft.metadataUri;

  // Fetch metadata JSON
  const response = await fetch(metadataUri);
  const metadata = await response.json();

  console.log("NFT Metadata:");
  console.log("  Name:", metadata.name);
  console.log("  Description:", metadata.description);
  console.log("  Image:", metadata.image);
  console.log("  Attributes:", metadata.attributes);

  return {
    ...result.data,
    metadata,
  };
}

// Run examples
if (require.main === module) {
  // validateSingleBurn().catch(console.error);
  // validateMultipleBurns().catch(console.error);
  // checkIfBurn().catch(console.error);
}

export {
  validateSingleBurn,
  validateMultipleBurns,
  checkIfBurn,
  validateAndStore,
  validateBurnForRaffle,
  extractMetadataFromBurn,
};
