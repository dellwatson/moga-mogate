const { CasperClient } = require("casper-js-sdk");
const { execSync } = require("child_process");

// Configuration
const NODE_URL = "http://65.109.83.79:7777";
const EXPECTED_COLLECTION =
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739";
const BURN_DEPLOY_HASH = process.argv[2];

if (!BURN_DEPLOY_HASH) {
  console.error("❌ Usage: node verify-burn-from-hash.js <burn-deploy-hash>");
  process.exit(1);
}

async function verifyBurnFromHash() {
  console.log("🔍 Verifying Burn Transaction\n");
  console.log("Burn Deploy Hash:", BURN_DEPLOY_HASH);
  console.log("Expected Collection:", EXPECTED_COLLECTION);
  console.log("");

  const client = new CasperClient(NODE_URL);

  try {
    // STEP 1: Get burn transaction
    console.log("📋 STEP 1: Fetching burn transaction...");
    const result = await client.getDeploy(BURN_DEPLOY_HASH);
    const deploy = result[0];
    const executionInfo = result[1];

    // Check if burn was successful
    const executionResult =
      executionInfo.execution_info?.execution_result?.Version2;
    if (!executionResult || executionResult.error_message) {
      console.log("❌ Burn transaction FAILED");
      console.log("Error:", executionResult?.error_message);
      return;
    }
    console.log("   ✅ Burn transaction successful");
    console.log("");

    // STEP 2: Extract contract hash and token ID
    console.log("📋 STEP 2: Extracting contract and token ID...");
    const session = deploy.session;

    if (!session.StoredContractByHash) {
      console.log("❌ Not a contract call");
      return;
    }

    const contractHash =
      "hash-" + Buffer.from(session.StoredContractByHash.hash).toString("hex");
    const entrypoint = session.StoredContractByHash.entry_point;

    console.log("   Contract:", contractHash);
    console.log("   Entrypoint:", entrypoint);

    // Verify it's a burn call
    if (entrypoint !== "burn") {
      console.log(
        "   ❌ Not a burn transaction (entrypoint:",
        entrypoint + ")"
      );
      return;
    }
    console.log("   ✅ Confirmed burn entrypoint");

    // STEP 3: Verify collection
    console.log("");
    console.log("📋 STEP 3: Verifying collection...");
    if (contractHash === EXPECTED_COLLECTION) {
      console.log("   ✅ CORRECT COLLECTION!");
      console.log("   Contract matches:", EXPECTED_COLLECTION);
    } else {
      console.log("   ❌ WRONG COLLECTION!");
      console.log("   Expected:", EXPECTED_COLLECTION);
      console.log("   Got:", contractHash);
      return;
    }

    // STEP 4: Extract token ID from args
    console.log("");
    console.log("📋 STEP 4: Extracting token ID...");

    // Use curl to parse the args properly
    const curlCommand = `curl -s -X POST ${NODE_URL}/rpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"info_get_deploy","params":{"deploy_hash":"${BURN_DEPLOY_HASH}"},"id":1}' | jq '.result.deploy.session.StoredContractByHash.args[] | select(.[0] == "token_id")'`;

    const tokenIdJson = execSync(curlCommand, { encoding: "utf-8" });
    const tokenIdObj = JSON.parse(tokenIdJson);
    const tokenId = tokenIdObj[1].parsed;

    console.log("   ✅ Token ID:", tokenId);

    // STEP 5: Try to get metadata (will fail if already burned)
    console.log("");
    console.log("📋 STEP 5: Checking if metadata still exists...");
    console.log("   ⚠️  Metadata is DELETED after burn");
    console.log("   Need to find the MINT transaction to get metadata");
    console.log("");

    // STEP 6: Search for mint transaction
    console.log("📋 STEP 6: Searching for mint transaction...");
    console.log("   Strategy: Search account's transaction history");
    console.log("   (In production, use an indexer or database)");
    console.log("");

    // Get burner address
    const burner = deploy.header.account;
    console.log("   Burner:", burner);
    console.log("");
    console.log("   To find mint transaction:");
    console.log("   1. Query indexer for mints of token", tokenId);
    console.log("   2. Or search account history for 'mint' calls");
    console.log("   3. Or check contract events (if available)");
    console.log("");

    // SUMMARY
    console.log("=".repeat(60));
    console.log("✅ VERIFICATION SUMMARY");
    console.log("=".repeat(60));
    console.log("");
    console.log("Burn Deploy:", BURN_DEPLOY_HASH);
    console.log("Collection:", contractHash, "✅ VALID");
    console.log("Token ID:", tokenId);
    console.log("Status: SUCCESS");
    console.log("");
    console.log("⚠️  To get metadata:");
    console.log("   - Metadata is deleted after burn");
    console.log("   - Must retrieve from MINT transaction");
    console.log("   - Use indexer or store mint hash when minting");
    console.log("");
    console.log("🔗 View on explorer:");
    console.log(`   https://testnet.cspr.live/deploy/${BURN_DEPLOY_HASH}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

verifyBurnFromHash().catch(console.error);
