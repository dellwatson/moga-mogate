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
const EXISTING_CONTRACT_HASH =
  "hash-011b472d6ba72303df22357de62f347b6f4dd0aac4d2804fa3e1604e00a4065a";
const PAYMENT_AMOUNT = "150000000000"; // 150 CSPR for upgrade

async function upgradeAuthorityMint() {
  console.log("🔄 Upgrading Authority Mint to V2 (with CEP-95 support)\n");

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
  console.log("Existing contract:", EXISTING_CONTRACT_HASH);
  console.log("WASM:", WASM_PATH);
  console.log("Payment:", PAYMENT_AMOUNT, "motes (150 CSPR)");
  console.log("");

  // Read WASM
  const wasmBuffer = fs.readFileSync(WASM_PATH);
  console.log("WASM size:", wasmBuffer.length, "bytes");

  // Get package hash from contract hash
  const contractHashBytes = EXISTING_CONTRACT_HASH.replace("hash-", "");

  // Create upgrade deploy using contract package
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
  console.log("📤 Sending upgrade deploy...");
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Upgrade deploy submitted!");
  console.log("Deploy hash:", deployHash);
  console.log("");
  console.log("Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);
  console.log("");
  console.log(
    "⚠️  NOTE: This creates a NEW contract. For true upgrade, you need the package hash."
  );
  console.log("The existing contract will remain at:", EXISTING_CONTRACT_HASH);

  // Save result
  const result = {
    timestamp: new Date().toISOString(),
    deployHash: deployHash,
    type: "UPGRADE_ATTEMPT",
    version: "v2_with_cep95_support",
    existingContract: EXISTING_CONTRACT_HASH,
    wasmPath: WASM_PATH,
    payment: PAYMENT_AMOUNT,
    explorerLink: `https://testnet.cspr.live/deploy/${deployHash}`,
    note: "This actually deploys a NEW contract. Use fresh deploy instead for clean V2.",
  };

  fs.writeFileSync(
    "/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/deployment-casper/AUTHORITY-MINT-V2-UPGRADE.json",
    JSON.stringify(result, null, 2)
  );

  console.log(
    "\n✅ Result saved to deployment-casper/AUTHORITY-MINT-V2-UPGRADE.json"
  );
}

upgradeAuthorityMint().catch(console.error);
