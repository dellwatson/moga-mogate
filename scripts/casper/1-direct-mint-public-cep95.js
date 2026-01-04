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
const PUBLIC_CEP95_HASH =
  "hash-d3cd76c35943ab698ab24aa1991a5ad3082da8128849005b5bbd7eab65fb8ffe";
const PAYMENT_AMOUNT = "5000000000";
const TOKEN_ID = "300";

async function mintPublicCEP95() {
  console.log("🎨 TASK 1: Direct Mint on OwnedCep95 (deployed CEP-95)\n");

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

  console.log("Minter:", accountPublicKey);
  console.log("PUBLIC CEP-95:", PUBLIC_CEP95_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("");

  // CEP-95 metadata - List of Tuple2(String, String)
  const metadata = CLValueBuilder.list([
    CLValueBuilder.tuple2([
      CLValueBuilder.string("name"),
      CLValueBuilder.string("Direct Minted NFT #300"),
    ]),
    CLValueBuilder.tuple2([
      CLValueBuilder.string("symbol"),
      CLValueBuilder.string("PUBNFT"),
    ]),
    CLValueBuilder.tuple2([
      CLValueBuilder.string("token_uri"),
      CLValueBuilder.string(
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/300/metadata.json"
      ),
    ]),
  ]);

  // Create runtime args
  const runtimeArgs = RuntimeArgs.fromMap({
    to: CLValueBuilder.key(clPublicKey),
    token_id: CLValueBuilder.u256(TOKEN_ID),
    metadata: metadata,
  });

  // Create deploy
  const contractHashBytes = PUBLIC_CEP95_HASH.replace("hash-", "");
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

  console.log("📤 Sending direct mint deploy...");

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
        console.log("✅ DIRECT MINT SUCCESS!");
        console.log("   NFT #300 minted on PUBLIC CEP-95!");
        console.log("   Anyone can mint - no owner check!");
        console.log("");

        // Save proof
        const fs = require("fs");
        const proof = {
          deployHash: deployHash,
          blockHash: result[1].header.block_hash,
          contract: PUBLIC_CEP95_HASH,
          tokenId: TOKEN_ID,
          recipient: accountPublicKey,
          method: "Direct mint on PUBLIC CEP-95",
          status: "SUCCESS",
          timestamp: new Date().toISOString(),
          explorerLink: `https://testnet.cspr.live/deploy/${deployHash}`,
        };

        fs.writeFileSync(
          "deployment-casper/direct-mint-public-cep95-proof.json",
          JSON.stringify(proof, null, 2)
        );
        console.log(
          "📊 Proof saved to: deployment-casper/direct-mint-public-cep95-proof.json"
        );
      } else if (executionResult.Failure) {
        console.log("❌ MINT FAILED:", executionResult.Failure.error_message);
      }
    } else {
      console.log("⚠️  Deploy still pending");
    }
  } catch (error) {
    console.log("⚠️  Error:", error.message);
  }
}

mintPublicCEP95().catch(console.error);
