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
const AUTHORITY_MINT_HASH =
  "hash-b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc";
const COLLECTION_HASH =
  process.argv[2] ||
  "hash-d3cd76c35943ab698ab24aa1991a5ad3082da8128849005b5bbd7eab65fb8ffe"; // Default: OwnedCep95
const PAYMENT_AMOUNT = "3000000000";

if (!COLLECTION_HASH.startsWith("hash-")) {
  console.error("❌ Invalid collection hash");
  process.exit(1);
}

async function whitelistCollection() {
  console.log("🔐 Whitelisting Collection in Authority Mint\n");

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

  console.log("Caller:", accountPublicKey);
  console.log("Authority Mint:", AUTHORITY_MINT_HASH);
  console.log("Collection to whitelist:", COLLECTION_HASH);
  console.log("");

  // Parse collection hash
  const collectionHashBytes = COLLECTION_HASH.replace("hash-", "");

  // Create runtime args
  const runtimeArgs = RuntimeArgs.fromMap({
    collection_hash: CLValueBuilder.byteArray(
      Uint8Array.from(Buffer.from(collectionHashBytes, "hex"))
    ),
  });

  // Create deploy
  const contractHashBytes = AUTHORITY_MINT_HASH.replace("hash-", "");
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME, 1, 1800000),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Uint8Array.from(Buffer.from(contractHashBytes, "hex")),
      "allow_collection",
      runtimeArgs
    ),
    DeployUtil.standardPayment(PAYMENT_AMOUNT)
  );

  // Sign deploy
  const signedDeploy = deploy.sign([keyPair]);

  console.log("📤 Sending whitelist deploy...");

  // Send deploy
  const client = new CasperClient(NODE_URL);
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Deploy submitted!");
  console.log("Deploy hash:", deployHash);
  console.log("");
  console.log("⏳ Waiting for execution...");

  // Wait for execution
  await new Promise((resolve) => setTimeout(resolve, 25000));

  try {
    const result = await client.getDeploy(deployHash);
    if (
      result[1] &&
      result[1].execution_results &&
      result[1].execution_results[0]
    ) {
      const executionResult = result[1].execution_results[0].result;

      if (executionResult.Success) {
        console.log("✅ WHITELIST SUCCESSFUL!");
        console.log("   Collection is now allowed!");
        console.log("");
        console.log("🎯 Next: Mint via authority");
        console.log(
          `   node scripts/casper/mint-via-authority-cep78.js ${COLLECTION_HASH}`
        );
      } else if (executionResult.Failure) {
        console.log(
          "❌ WHITELIST FAILED:",
          executionResult.Failure.error_message
        );
      }
    } else {
      console.log("⚠️  Deploy still pending");
    }
  } catch (error) {
    console.log("⚠️  Could not fetch result:", error.message);
  }
}

whitelistCollection().catch(console.error);
