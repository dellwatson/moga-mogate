const { CasperClient, CLValueBuilder, CLPublicKey } = require("casper-js-sdk");

// Configuration
const NODE_URL = "http://65.109.83.79:7777";
const CONTRACT_HASH = process.argv[2];
const TOKEN_ID = process.argv[3];

if (!CONTRACT_HASH || !TOKEN_ID) {
  console.error(
    "❌ Usage: node get-nft-metadata.js <contract-hash> <token-id>"
  );
  console.error("   Example: node get-nft-metadata.js hash-abc123... 1");
  process.exit(1);
}

async function getMetadata() {
  console.log("📖 Getting NFT Metadata\n");
  console.log("Contract:", CONTRACT_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("");

  const client = new CasperClient(NODE_URL);

  try {
    // Get contract state root hash
    const stateRootHash = await client.nodeClient.getStateRootHash();
    console.log("State Root Hash:", stateRootHash);
    console.log("");

    // Query token_metadata dictionary
    const contractHashBytes = CONTRACT_HASH.replace("hash-", "");
    const contractKey = `hash-${contractHashBytes}`;

    // Try to get the metadata dictionary URef
    console.log("🔍 Querying contract state...");

    try {
      // Get contract data
      const contractData = await client.nodeClient.getBlockState(
        stateRootHash,
        contractKey,
        []
      );

      if (contractData && contractData.Contract) {
        console.log("✅ Contract found");
        console.log("");

        // Look for metadata-related named keys
        const namedKeys = contractData.Contract.named_keys;
        console.log("📋 Contract Named Keys:");
        namedKeys.forEach((nk) => {
          console.log(`   ${nk.name}: ${nk.key}`);
        });
        console.log("");

        // Find token_metadata dictionary
        const metadataKey = namedKeys.find(
          (nk) =>
            nk.name.includes("token_metadata") || nk.name.includes("metadata")
        );

        if (metadataKey) {
          console.log("🔍 Found metadata dictionary:", metadataKey.key);
          console.log("");

          // Query the dictionary for this token_id
          // Note: This requires the dictionary URef and proper key encoding
          console.log("⚠️  Dictionary query requires:");
          console.log("   1. Dictionary URef from named keys");
          console.log("   2. Token ID as dictionary key");
          console.log("   3. Proper CLValue encoding");
          console.log("");
          console.log("💡 Alternative: Use casper-client query-global-state");
          console.log(`   casper-client query-global-state \\`);
          console.log(`     --node-address ${NODE_URL} \\`);
          console.log(`     --state-root-hash ${stateRootHash} \\`);
          console.log(`     --key ${metadataKey.key} \\`);
          console.log(`     -q "${TOKEN_ID}"`);
        } else {
          console.log("⚠️  No metadata dictionary found in named keys");
        }
      }
    } catch (queryError) {
      console.log("⚠️  Could not query contract state:", queryError.message);
      console.log("");
      console.log("💡 Try using casper-client directly:");
      console.log(`   casper-client query-global-state \\`);
      console.log(`     --node-address ${NODE_URL} \\`);
      console.log(`     --state-root-hash ${stateRootHash} \\`);
      console.log(`     --key ${contractKey}`);
    }

    console.log("");
    console.log("📝 Note: Metadata retrieval from Casper requires:");
    console.log("   - Knowing the dictionary URef");
    console.log("   - Proper CLValue encoding for dictionary keys");
    console.log("   - Or using an indexer service");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

getMetadata().catch(console.error);
