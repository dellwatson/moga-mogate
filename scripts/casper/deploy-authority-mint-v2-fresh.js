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
  "/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/contracts/authority_mint/target/wasm32-unknown-unknown/release/authority_mint.wasm";
const PAYMENT_AMOUNT = "200000000000"; // 200 CSPR for fresh deploy

async function deployAuthorityMintV2() {
  console.log("🚀 Deploying Authority Mint V2 (with CEP-95 support) - FRESH\n");

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

  console.log("Deployer:", accountPublicKey);
  console.log("WASM:", WASM_PATH);
  console.log("Payment:", PAYMENT_AMOUNT, "motes (200 CSPR)");
  console.log("");

  // Read WASM
  const wasmBuffer = fs.readFileSync(WASM_PATH);
  console.log("WASM size:", wasmBuffer.length, "bytes");

  // Create deploy
  const deployParams = new DeployUtil.DeployParams(
    CLPublicKey.fromHex(accountPublicKey),
    CHAIN_NAME
  );

  const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
    wasmBuffer,
    RuntimeArgs.fromMap({})
  );

  const payment = DeployUtil.standardPayment(PAYMENT_AMOUNT);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

  // Send deploy
  const client = new CasperClient(NODE_URL);
  console.log("📤 Sending fresh deploy...");
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Deploy submitted!");
  console.log("Deploy hash:", deployHash);
  console.log("");
  console.log("Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  // Save result
  const result = {
    timestamp: new Date().toISOString(),
    deployHash: deployHash,
    type: "FRESH_DEPLOY",
    version: "v2_with_cep95_support",
    wasmPath: WASM_PATH,
    payment: PAYMENT_AMOUNT,
    explorerLink: `https://testnet.cspr.live/deploy/${deployHash}`,
    note: "New Authority Mint with mint_cep95() function for CEP-95 collections",
  };

  fs.writeFileSync(
    "/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/deployment-casper/AUTHORITY-MINT-V2-FRESH.json",
    JSON.stringify(result, null, 2)
  );

  console.log(
    "\n✅ Result saved to deployment-casper/AUTHORITY-MINT-V2-FRESH.json"
  );
}

deployAuthorityMintV2().catch(console.error);
