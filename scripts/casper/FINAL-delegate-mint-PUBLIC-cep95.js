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
const NEW_AUTHORITY_MINT_HASH =
  "hash-011b472d6ba72303df22357de62f347b6f4dd0aac4d2804fa3e1604e00a4065a";
const PUBLIC_CEP95_HASH =
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739"; // PUBLIC CEP-95!
const PAYMENT_AMOUNT = "800000000000"; // 800 CSPR - EXTREME gas for delegate call

async function delegateMint() {
  console.log("🎯 Delegate Mint: NEW Authority Mint → PUBLIC CEP-95\n");

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
  console.log("NEW Authority Mint (NO whitelist):", NEW_AUTHORITY_MINT_HASH);
  console.log("PUBLIC CEP-95:", PUBLIC_CEP95_HASH);
  console.log("");

  // CEP-78 metadata format (JSON string)
  const metadataJson = JSON.stringify({
    name: "Delegate Minted on PUBLIC CEP-95 #501",
    token_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/501/metadata.json",
  });

  // Parse collection hash
  const collectionHashBytes = PUBLIC_CEP95_HASH.replace("hash-", "");

  // Create runtime args for Authority Mint's mint_nft
  const runtimeArgs = RuntimeArgs.fromMap({
    collection_hash: CLValueBuilder.byteArray(
      Uint8Array.from(Buffer.from(collectionHashBytes, "hex"))
    ),
    token_owner: CLValueBuilder.key(clPublicKey),
    token_metadata: CLValueBuilder.string(metadataJson),
  });

  // Create deploy
  const contractHashBytes = NEW_AUTHORITY_MINT_HASH.replace("hash-", "");
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

  console.log("📤 Sending delegate mint on PUBLIC CEP-95...");

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
        console.log("✅ SUCCESS! DELEGATE MINT ON PUBLIC CEP-95!");
        console.log("   NEW Authority Mint → PUBLIC CEP-95!");
        console.log("   NFT #401 minted!");
        console.log("");

        // Save proof
        const fs = require("fs");
        const proof = {
          deployHash: deployHash,
          blockHash: result[1].header.block_hash,
          newAuthorityMint: NEW_AUTHORITY_MINT_HASH,
          publicCep95: PUBLIC_CEP95_HASH,
          recipient: accountPublicKey,
          metadata: JSON.parse(metadataJson),
          status: "SUCCESS",
          timestamp: new Date().toISOString(),
          explorerLink: `https://testnet.cspr.live/deploy/${deployHash}`,
        };

        fs.writeFileSync(
          "deployment-casper/PUBLIC-CEP95-DELEGATE-MINT-PROOF.json",
          JSON.stringify(proof, null, 2)
        );
        console.log("📊 Proof saved!");
      } else if (executionResult.Failure) {
        console.log("❌ FAILED:", executionResult.Failure.error_message);
      }
    } else {
      console.log("⚠️  Deploy still pending");
    }
  } catch (error) {
    console.log("⚠️  Error:", error.message);
  }
}

delegateMint().catch(console.error);
