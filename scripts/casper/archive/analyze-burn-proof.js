const { CasperClient } = require("casper-js-sdk");
const fs = require("fs");

// Configuration
const NODE_URL = "http://65.109.83.79:7777";
const BURN_DEPLOY_HASH = process.argv[2];

if (!BURN_DEPLOY_HASH) {
  console.error("❌ Usage: node analyze-burn-proof.js <burn-deploy-hash>");
  process.exit(1);
}

async function analyzeBurnProof() {
  console.log("🔍 Analyzing Burn Proof\n");
  console.log("Deploy Hash:", BURN_DEPLOY_HASH);
  console.log("");

  const client = new CasperClient(NODE_URL);

  try {
    // Get burn deploy
    const result = await client.getDeploy(BURN_DEPLOY_HASH);

    if (!result || !result[1]) {
      console.log("❌ Deploy not found");
      return;
    }

    const deploy = result[0];
    const executionInfo = result[1];

    console.log("📋 BURN TRANSACTION DETAILS");
    console.log("=".repeat(60));
    console.log("");

    // Basic info
    console.log("🔹 Transaction Info:");
    console.log("   Deploy Hash:", BURN_DEPLOY_HASH);
    console.log(
      "   Block Hash:",
      executionInfo.execution_results[0]?.block_hash || "N/A"
    );
    console.log("   Timestamp:", deploy.header.timestamp);
    console.log("");

    // Caller info
    const callerPublicKey = deploy.header.account;
    console.log("🔹 Burner:");
    console.log("   Public Key:", callerPublicKey);
    console.log("   Account Hash:", deploy.header.account);
    console.log("");

    // Extract contract and token_id from session
    const session = deploy.session;
    let contractHash = "N/A";
    let tokenId = "N/A";
    let entrypoint = "N/A";

    if (session.StoredContractByHash) {
      contractHash =
        "hash-" +
        Buffer.from(session.StoredContractByHash.hash).toString("hex");
      entrypoint = session.StoredContractByHash.entry_point;

      // Extract token_id from args
      const args = session.StoredContractByHash.args;
      if (args && args.length > 0) {
        try {
          // Parse RuntimeArgs to get token_id
          const argsBytes = Buffer.from(args);
          // This is a simplified extraction - actual parsing would need CLValue decoding
          console.log("   Raw Args Length:", argsBytes.length, "bytes");
        } catch (e) {
          console.log("   Could not parse args");
        }
      }
    }

    console.log("🔹 Contract Call:");
    console.log("   Contract:", contractHash);
    console.log("   Entrypoint:", entrypoint);
    console.log("   Token ID:", tokenId, "(check transforms below)");
    console.log("");

    // Execution result
    const executionResult = executionInfo.execution_results[0]?.result;
    if (executionResult) {
      if (executionResult.Success) {
        console.log("✅ Execution: SUCCESS");
        console.log("   Cost:", executionResult.Success.cost);
        console.log("");

        // Analyze transforms to find metadata
        console.log("🔹 State Changes (Transforms):");
        const transforms = executionResult.Success.effect.transforms;

        let metadataFound = false;
        transforms.forEach((transform, idx) => {
          const key = transform.key;
          const transformType = transform.transform;

          // Look for metadata-related keys
          if (key.includes("metadata") || key.includes("token")) {
            console.log(`   [${idx}] ${key}`);
            console.log(`       Transform: ${Object.keys(transformType)[0]}`);

            if (transformType.WriteCLValue) {
              const parsed = transformType.WriteCLValue.parsed;
              if (parsed) {
                console.log(`       Value: ${JSON.stringify(parsed, null, 2)}`);
                metadataFound = true;
              }
            }
          }
        });

        if (!metadataFound) {
          console.log("   No metadata found in transforms (already burned)");
        }
        console.log("");

        // Try to extract metadata from contract state BEFORE burn
        console.log("🔹 NFT Metadata (if available):");
        console.log("   Note: Metadata is typically removed during burn");
        console.log("   To get metadata, query BEFORE burning or from indexer");
        console.log("");
      } else if (executionResult.Failure) {
        console.log("❌ Execution: FAILED");
        console.log("   Error:", executionResult.Failure.error_message);
        console.log("");
      }
    }

    // Generate burn proof JSON
    const burnProof = {
      deployHash: BURN_DEPLOY_HASH,
      blockHash: executionInfo.execution_results[0]?.block_hash,
      timestamp: deploy.header.timestamp,
      burner: {
        publicKey: callerPublicKey,
        accountHash: deploy.header.account,
      },
      contract: contractHash,
      tokenId: tokenId,
      entrypoint: entrypoint,
      success: executionResult?.Success ? true : false,
      cost: executionResult?.Success?.cost || 0,
      network: "casper-test",
      nodeUrl: NODE_URL,
    };

    const proofFile = `burn-proof-${BURN_DEPLOY_HASH.substring(0, 16)}.json`;
    fs.writeFileSync(proofFile, JSON.stringify(burnProof, null, 2));

    console.log("💾 Burn Proof saved to:", proofFile);
    console.log("");
    console.log("🔗 View on Explorer:");
    console.log(`   https://testnet.cspr.live/deploy/${BURN_DEPLOY_HASH}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

async function getMetadataBeforeBurn(contractHash, tokenId) {
  console.log("\n🔍 Attempting to retrieve metadata...");
  console.log("   Contract:", contractHash);
  console.log("   Token ID:", tokenId);
  console.log("");
  console.log("⚠️  Note: This requires querying contract state");
  console.log("   Metadata is removed after burn");
  console.log("   Use an indexer or query before burning");
}

analyzeBurnProof().catch(console.error);
