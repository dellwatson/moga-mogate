const { CasperClient, CLPublicKey } = require("casper-js-sdk");

// Configuration
const NODE_URL = "http://65.109.83.79:7777";
const PUBLIC_CEP95_HASH =
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739";
const TOKEN_ID = process.argv[2] || "502";

async function checkNFTMetadata() {
  console.log("🔍 Checking NFT Metadata\n");
  console.log("Contract:", PUBLIC_CEP95_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("");

  const client = new CasperClient(NODE_URL);

  try {
    // Get the contract's state root hash
    const stateRootHash = await client.nodeClient.getStateRootHash();

    // Query the token metadata dictionary
    const contractHashBytes = PUBLIC_CEP95_HASH.replace("hash-", "");

    // Try to get token_metadata dictionary
    const metadataResult = await client.nodeClient.getDictionaryItemByName(
      stateRootHash,
      `hash-${contractHashBytes}`,
      "token_metadata",
      TOKEN_ID
    );

    console.log("✅ Token Metadata Found!\n");
    console.log(JSON.stringify(metadataResult, null, 2));

    // Parse the metadata
    if (metadataResult.CLValue && metadataResult.CLValue.parsed) {
      const metadata = metadataResult.CLValue.parsed;
      console.log("\n📋 Parsed Metadata:");

      if (Array.isArray(metadata)) {
        metadata.forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
          if (key === "token_uri") {
            console.log(`\n🔗 Token URI: ${value}`);
          }
        });
      } else {
        console.log(metadata);
      }
    }
  } catch (error) {
    console.log("❌ Error:", error.message);

    // Try alternative method - query owner
    try {
      console.log("\n🔄 Trying to get token owner...");
      const ownerResult = await client.nodeClient.getDictionaryItemByName(
        await client.nodeClient.getStateRootHash(),
        PUBLIC_CEP95_HASH,
        "owners",
        TOKEN_ID
      );
      console.log("Token Owner:", ownerResult);
    } catch (err) {
      console.log("Could not get owner:", err.message);
    }
  }
}

checkNFTMetadata().catch(console.error);
