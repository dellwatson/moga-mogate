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
const PUBLIC_CEP95_HASH = "PENDING"; // Will be filled after deployment
const PAYMENT_AMOUNT = "5000000000";
const TOKEN_ID = "100";

async function delegateMint() {
  console.log("🎯 Delegate Minting via Authority Mint Contract\n");

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
  console.log("Public CEP-95:", PUBLIC_CEP95_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("");

  // Create metadata
  const metadata = CLValueBuilder.list([
    CLValueBuilder.tuple2([
      CLValueBuilder.string("name"),
      CLValueBuilder.string("Delegated Mint NFT"),
    ]),
    CLValueBuilder.tuple2([
      CLValueBuilder.string("symbol"),
      CLValueBuilder.string("DELEGATE"),
    ]),
    CLValueBuilder.tuple2([
      CLValueBuilder.string("token_uri"),
      CLValueBuilder.string(
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json"
      ),
    ]),
  ]);

  // Parse collection address (PublicCep95 contract)
  const collectionHashBytes = PUBLIC_CEP95_HASH.replace("hash-", "");
  const collectionKey = CLValueBuilder.key(
    CLValueBuilder.byteArray(
      Uint8Array.from(Buffer.from(collectionHashBytes, "hex"))
    )
  );

  // Create runtime args for Authority Mint's mint_for_collection
  const runtimeArgs = RuntimeArgs.fromMap({
    collection: collectionKey,
    to: CLValueBuilder.key(clPublicKey),
    token_id: CLValueBuilder.u256(TOKEN_ID),
    metadata: metadata,
  });

  // Create deploy
  const contractHashBytes = AUTHORITY_MINT_HASH.replace("hash-", "");
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME, 1, 1800000),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Uint8Array.from(Buffer.from(contractHashBytes, "hex")),
      "mint_for_collection",
      runtimeArgs
    ),
    DeployUtil.standardPayment(PAYMENT_AMOUNT)
  );

  // Sign deploy
  const signedDeploy = deploy.sign([keyPair]);

  console.log("📤 Sending delegate mint deploy...");

  // Send deploy
  const client = new CasperClient(NODE_URL);
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Deploy submitted!");
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
        console.log("✅ DELEGATE MINT SUCCESSFUL!");
        console.log("   Authority Mint called Public CEP-95 mint!");
        console.log("   NFT minted via cross-contract call!");
      } else if (executionResult.Failure) {
        console.log(
          "❌ DELEGATE MINT FAILED:",
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

delegateMint().catch(console.error);
