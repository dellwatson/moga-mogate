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
const CONTRACT_HASH =
  "hash-68eaf8107a04d354202e4b60ed261ff17bc7c4a63411194bbb15939dcdbfdbcc";
const PAYMENT_AMOUNT = "5000000000";

async function mintCEP78() {
  console.log("🎫 Minting CEP-78 NFT using JavaScript SDK\n");

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
  console.log("");

  // Create CLPublicKey
  const clPublicKey = CLPublicKey.fromHex(accountPublicKey);

  // NFT721 metadata - JSON string
  const metadata = JSON.stringify({
    name: "Tixia Flight Credit",
    symbol: "TIX",
    token_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/casper-network/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json",
  });

  // Create runtime args for CEP-78 mint
  const runtimeArgs = RuntimeArgs.fromMap({
    token_owner: CLValueBuilder.key(clPublicKey),
    token_meta_data: CLValueBuilder.string(metadata),
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
        console.log("✅ MINT SUCCESSFUL!");
      } else if (executionResult.Failure) {
        console.log("❌ MINT FAILED:", executionResult.Failure.error_message);
      }
    } else {
      console.log("⚠️  Deploy still pending, check manually");
    }
  } catch (error) {
    console.log("⚠️  Could not fetch deploy result:", error.message);
  }
}

mintCEP78().catch(console.error);
