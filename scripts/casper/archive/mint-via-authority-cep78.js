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
const COLLECTION_HASH = process.argv[2]; // Pass as argument
const PAYMENT_AMOUNT = "5000000000";

if (!COLLECTION_HASH || !COLLECTION_HASH.startsWith("hash-")) {
  console.error("❌ Usage: node mint-via-authority-cep78.js <collection-hash>");
  console.error("   Example: node mint-via-authority-cep78.js hash-abc123...");
  process.exit(1);
}

async function mintViaAuthority() {
  console.log("🎯 Minting via Authority Mint (CEP-78)\n");

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
  console.log("Collection:", COLLECTION_HASH);
  console.log("");

  // CEP-78 metadata (JSON string)
  const metadata = JSON.stringify({
    name: "Authority Minted NFT",
    token_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json",
  });

  // Parse collection hash
  const collectionHashBytes = COLLECTION_HASH.replace("hash-", "");

  // Create runtime args for Authority Mint's mint_nft
  const runtimeArgs = RuntimeArgs.fromMap({
    collection_hash: CLValueBuilder.byteArray(
      Uint8Array.from(Buffer.from(collectionHashBytes, "hex"))
    ),
    token_owner: CLValueBuilder.key(clPublicKey),
    token_metadata: CLValueBuilder.string(metadata),
  });

  // Create deploy
  const contractHashBytes = AUTHORITY_MINT_HASH.replace("hash-", "");
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME, 1, 1800000),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Uint8Array.from(Buffer.from(contractHashBytes, "hex")),
      "mint_nft",
      runtimeArgs
    ),
    DeployUtil.standardPayment(PAYMENT_AMOUNT)
  );

  // Sign deploy
  const signedDeploy = deploy.sign([keyPair]);

  console.log("📤 Sending mint deploy...");

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
        console.log("✅ AUTHORITY MINT SUCCESSFUL!");
        console.log("   Authority Mint called CEP-78 collection!");
        console.log("   NFT minted via delegated authority!");
      } else if (executionResult.Failure) {
        console.log("❌ MINT FAILED:", executionResult.Failure.error_message);
        if (executionResult.Failure.error_message.includes("100")) {
          console.log("   → Collection not whitelisted!");
          console.log(
            "   → Run: node scripts/casper/whitelist-collection.js",
            COLLECTION_HASH
          );
        }
      }
    } else {
      console.log("⚠️  Deploy still pending");
    }
  } catch (error) {
    console.log("⚠️  Could not fetch result:", error.message);
  }
}

mintViaAuthority().catch(console.error);
