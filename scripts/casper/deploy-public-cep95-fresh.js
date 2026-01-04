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
  "/Users/dellwatson/Desktop/casper/odra/examples/wasm/PublicCep95.wasm";
const PAYMENT_AMOUNT = "500000000000"; // 500 CSPR - MUCH higher gas for large WASM
const CONTRACT_NAME = "TixiaPublicCEP95";
const SYMBOL = "TIXPUB";

async function deployPublicCep95() {
  console.log("🚀 Deploying PUBLIC CEP-95 (Fresh Build)\n");

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
  console.log("WASM:", WASM_PATH);
  console.log("Payment:", PAYMENT_AMOUNT, "motes (500 CSPR)");
  console.log("");

  // Read WASM
  const wasmBytes = new Uint8Array(fs.readFileSync(WASM_PATH));
  console.log("WASM size:", wasmBytes.length, "bytes");
  console.log("");

  // Create runtime args for init
  const runtimeArgs = RuntimeArgs.fromMap({
    name: CLValueBuilder.string(CONTRACT_NAME),
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
  console.log("Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    action: "Deploy PUBLIC CEP-95 (Fresh Build)",
    deployHash: deployHash,
    timestamp: new Date().toISOString(),
    wasm: WASM_PATH,
    name: CONTRACT_NAME,
    symbol: SYMBOL,
    payment: PAYMENT_AMOUNT,
    explorerLink: `https://testnet.cspr.live/deploy/${deployHash}`,
    status: "PENDING",
    note: "Rebuilt WASM on " + new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployment-casper/PUBLIC-CEP95-FRESH-DEPLOY.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(
    "📁 Deployment info saved to deployment-casper/PUBLIC-CEP95-FRESH-DEPLOY.json"
  );
  console.log("");
  console.log("⏳ Wait 2-3 minutes, then check:");
  console.log("   ./scripts/casper/quick-status.sh");
}

deployPublicCep95().catch(console.error);
