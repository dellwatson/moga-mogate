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
const WASM_PATH =
  "/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/contracts/public_cep95/wasm/PublicCep95.wasm";
const PAYMENT_AMOUNT = "500000000000"; // 500 CSPR
const NAME = "TixiaPublicCEP95";
const SYMBOL = "TIXPUB";

async function deployPublicCEP95() {
  console.log("🚀 Deploying Public CEP-95 NFT Contract\n");

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

  console.log("Deployer:", accountPublicKey);
  console.log("Name:", NAME);
  console.log("Symbol:", SYMBOL);
  console.log("");

  // Read WASM
  const wasmBytes = fs.readFileSync(WASM_PATH);

  // Create runtime args
  const runtimeArgs = RuntimeArgs.fromMap({
    odra_cfg_package_hash_key_name: CLValueBuilder.string(
      "public_cep95_package_hash"
    ),
    odra_cfg_allow_key_override: CLValueBuilder.bool(true),
    odra_cfg_is_upgradable: CLValueBuilder.bool(true),
    odra_cfg_is_upgrade: CLValueBuilder.bool(false),
    name: CLValueBuilder.string(NAME),
    symbol: CLValueBuilder.string(SYMBOL),
  });

  // Create deploy
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME, 1, 1800000),
    DeployUtil.ExecutableDeployItem.newModuleBytes(wasmBytes, runtimeArgs),
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
  console.log(
    "⏳ Waiting for contract to deploy (this may take 60+ seconds)..."
  );

  // Wait for execution
  await new Promise((resolve) => setTimeout(resolve, 60000));

  try {
    const result = await client.getDeploy(deployHash);
    if (
      result[1] &&
      result[1].execution_results &&
      result[1].execution_results[0]
    ) {
      const executionResult = result[1].execution_results[0].result;

      if (executionResult.Success) {
        console.log("✅ DEPLOYMENT SUCCESSFUL!");
        console.log("\nTo get contract hash, run:");
        console.log(
          `casper-client get-deploy --node-address ${NODE_URL} ${deployHash}`
        );
      } else if (executionResult.Failure) {
        console.log(
          "❌ DEPLOYMENT FAILED:",
          executionResult.Failure.error_message
        );
      }
    } else {
      console.log(
        "⚠️  Deploy still pending, check manually with deploy hash above"
      );
    }
  } catch (error) {
    console.log("⚠️  Could not fetch deploy result:", error.message);
  }
}

deployPublicCEP95().catch(console.error);
