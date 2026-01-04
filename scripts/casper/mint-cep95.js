const {
  CasperClient,
  CLValueBuilder,
  RuntimeArgs,
  DeployUtil,
  Keys,
  CLPublicKey,
} = require("casper-js-sdk");
const fs = require("fs");

// Configuration
const NODE_URL = "http://65.109.83.79:7777";
const CHAIN_NAME = "casper-test";
const SECRET_KEY_PATH =
  "/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem";
const CONTRACT_HASH =
  "hash-d3cd76c35943ab698ab24aa1991a5ad3082da8128849005b5bbd7eab65fb8ffe";
const TOKEN_ID = "1";
const PAYMENT_AMOUNT = "5000000000";

async function mintCEP95() {
  console.log("🎨 Minting CEP-95 NFT using JavaScript SDK\n");

  // Load keys - using raw hex to avoid PEM parsing issues
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

  console.log("Caller:", accountPublicKey);
  console.log("Contract:", CONTRACT_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("");

  // Create metadata as List of Tuple2<String, String>
  const metadata = CLValueBuilder.list([
    CLValueBuilder.tuple2([
      CLValueBuilder.string("name"),
      CLValueBuilder.string("Tixia Flight Credit"),
    ]),
    CLValueBuilder.tuple2([
      CLValueBuilder.string("symbol"),
      CLValueBuilder.string("TIX95"),
    ]),
    CLValueBuilder.tuple2([
      CLValueBuilder.string("token_uri"),
      CLValueBuilder.string(
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json"
      ),
    ]),
  ]);

  // Create CLPublicKey
  const clPublicKey = CLPublicKey.fromHex(accountPublicKey);

  // Create runtime args
  const runtimeArgs = RuntimeArgs.fromMap({
    to: CLValueBuilder.key(clPublicKey),
    token_id: CLValueBuilder.u256(TOKEN_ID),
    metadata: metadata,
  });

  // Create deploy
  const contractHashBytes = CONTRACT_HASH.replace("hash-", "");
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME, 1, 1800000),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Uint8Array.from(Buffer.from(contractHashBytes, "hex")),
      "mint",
      runtimeArgs
    ),
    DeployUtil.standardPayment(PAYMENT_AMOUNT)
  );

  // Sign deploy
  const signedDeploy = deploy.sign([keyPair]);

  console.log("📤 Sending deploy...");

  // Send deploy
  const client = new CasperClient(NODE_URL);
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Deploy submitted!");
  console.log("Deploy hash:", deployHash);
  console.log("");
  console.log("Waiting for execution...");

  // Wait for execution
  await new Promise((resolve) => setTimeout(resolve, 20000));

  try {
    const result = await client.getDeploy(deployHash);
    const executionResult = result[1].execution_results[0].result;

    if (executionResult.Success) {
      console.log("✅ MINT SUCCESSFUL!");
    } else if (executionResult.Failure) {
      console.log("❌ MINT FAILED:", executionResult.Failure.error_message);
    }
  } catch (error) {
    console.log("⚠️  Could not fetch deploy result:", error.message);
  }
}

mintCEP95().catch(console.error);
