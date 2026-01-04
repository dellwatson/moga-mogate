const {
  CasperClient,
  CLValueBuilder,
  RuntimeArgs,
  DeployUtil,
  Keys,
  CLPublicKey,
} = require("casper-js-sdk");

// Configuration
const NODE_URL = "http://65.109.83.79:7777";
const CHAIN_NAME = "casper-test";
const CONTRACT_HASH = process.argv[2]; // Pass as argument
const TOKEN_ID = process.argv[3]; // Pass as argument
const PAYMENT_AMOUNT = "3000000000";

if (!CONTRACT_HASH || !TOKEN_ID) {
  console.error("❌ Usage: node burn-nft-cep95.js <contract-hash> <token-id>");
  console.error("   Example: node burn-nft-cep95.js hash-abc123... 1");
  process.exit(1);
}

async function burnNFT() {
  console.log("🔥 Burning CEP-95 NFT\n");

  // Load keys
  const privateKeyHex =
    "714ce7a284d20565c24791c4692ce8c246d6667159bd1cb799d42f9a327c8579";
  const privateKeyBytes = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  const publicKeyBytes = Keys.Secp256K1.privateToPublicKey(privateKeyBytes);
  const keyPair = Keys.Secp256K1.parseKeyPair(
    publicKeyBytes,
    privateKeyBytes,
    "raw"
  );
  const accountPublicKey = Keys.Secp256K1.accountHex(publicKeyBytes);
  const clPublicKey = CLPublicKey.fromHex(accountPublicKey);

  console.log("Burner:", accountPublicKey);
  console.log("Contract:", CONTRACT_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("");

  // Create runtime args
  const runtimeArgs = RuntimeArgs.fromMap({
    token_id: CLValueBuilder.u256(TOKEN_ID),
  });

  // Create deploy
  const contractHashBytes = CONTRACT_HASH.replace("hash-", "");
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME, 1, 1800000),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Uint8Array.from(Buffer.from(contractHashBytes, "hex")),
      "burn",
      runtimeArgs
    ),
    DeployUtil.standardPayment(PAYMENT_AMOUNT)
  );

  // Sign deploy
  const signedDeploy = deploy.sign([keyPair]);

  console.log("📤 Sending burn deploy...");

  // Send deploy
  const client = new CasperClient(NODE_URL);
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Burn deploy submitted!");
  console.log("Deploy hash:", deployHash);
  console.log("");
  console.log("⏳ Waiting for execution...");

  // Wait for execution
  await new Promise((resolve) => setTimeout(resolve, 30000));

  try {
    const result = await client.getDeploy(deployHash);
    if (
      result[1] &&
      result[1].execution_results &&
      result[1].execution_results[0]
    ) {
      const executionResult = result[1].execution_results[0].result;

      if (executionResult.Success) {
        console.log("✅ NFT BURNED SUCCESSFULLY!");
        console.log("");
        console.log("📊 Burn Proof:");
        console.log("   Deploy Hash:", deployHash);
        console.log(
          "   Block Hash:",
          result[1].execution_results[0].block_hash
        );
        console.log("   Contract:", CONTRACT_HASH);
        console.log("   Token ID:", TOKEN_ID);
        console.log("   Burner:", accountPublicKey);
        console.log("");
        console.log("🔍 To analyze burn proof, run:");
        console.log(
          `   node scripts/casper/analyze-burn-proof.js ${deployHash}`
        );
      } else if (executionResult.Failure) {
        console.log("❌ BURN FAILED:", executionResult.Failure.error_message);
      }
    } else {
      console.log("⚠️  Deploy still pending");
      console.log(
        `   Check later: casper-client get-deploy --node-address ${NODE_URL} ${deployHash}`
      );
    }
  } catch (error) {
    console.log("⚠️  Could not fetch result:", error.message);
  }
}

burnNFT().catch(console.error);
