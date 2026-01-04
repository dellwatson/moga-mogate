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
const OWNED_CEP95_HASH =
  "hash-d3cd76c35943ab698ab24aa1991a5ad3082da8128849005b5bbd7eab65fb8ffe";
const PAYMENT_AMOUNT = "5000000000";

async function delegateMint() {
  console.log("🎯 Delegate Mint via Authority Mint\n");

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
  console.log("Collection (OwnedCep95):", OWNED_CEP95_HASH);
  console.log("");

  // CEP-78 metadata format (JSON string)
  const metadataJson = JSON.stringify({
    name: "Delegate Minted NFT #201",
    token_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/201/metadata.json",
  });

  // Parse collection hash
  const collectionHashBytes = OWNED_CEP95_HASH.replace("hash-", "");

  // Create runtime args for Authority Mint's mint_nft
  const runtimeArgs = RuntimeArgs.fromMap({
    collection_hash: CLValueBuilder.byteArray(
      Uint8Array.from(Buffer.from(collectionHashBytes, "hex"))
    ),
    token_owner: CLValueBuilder.key(clPublicKey),
    token_metadata: CLValueBuilder.string(metadataJson),
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

  console.log("📤 Sending delegate mint deploy...");

  // Send deploy
  const client = new CasperClient(NODE_URL);
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Deploy submitted!");
  console.log("Deploy hash:", deployHash);
  console.log("");
  console.log("⏳ Waiting for execution (35s)...");

  // Wait for execution
  await new Promise((resolve) => setTimeout(resolve, 35000));

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
        console.log("   Authority Mint called OwnedCep95.mint()!");
        console.log("   Cross-contract call succeeded!");
        console.log("");

        // Save proof
        const fs = require("fs");
        const proof = {
          deployHash: deployHash,
          blockHash: result[1].header.block_hash,
          authorityMint: AUTHORITY_MINT_HASH,
          collection: OWNED_CEP95_HASH,
          recipient: accountPublicKey,
          metadata: JSON.parse(metadataJson),
          status: "SUCCESS",
          timestamp: new Date().toISOString(),
          explorerLink: `https://testnet.cspr.live/deploy/${deployHash}`,
        };

        fs.writeFileSync(
          "deployment-casper/delegate-mint-proof.json",
          JSON.stringify(proof, null, 2)
        );
        console.log(
          "📊 Proof saved to: deployment-casper/delegate-mint-proof.json"
        );
      } else if (executionResult.Failure) {
        console.log(
          "❌ DELEGATE MINT FAILED:",
          executionResult.Failure.error_message
        );
        if (executionResult.Failure.error_message.includes("100")) {
          console.log("   → Collection not whitelisted!");
          console.log(
            "   → Whitelist first: node scripts/casper/whitelist-collection.js",
            OWNED_CEP95_HASH
          );
        }
      }
    } else {
      console.log("⚠️  Deploy still pending");
    }
  } catch (error) {
    console.log("⚠️  Error:", error.message);
  }
}

delegateMint().catch(console.error);
