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
const AUTHORITY_MINT_V2_HASH =
  "hash-187345749048e98e2ecbbc4acbc2221a04c6a121cc8c32ddf12aaa706d3f7ef2";
const PUBLIC_CEP95_HASH =
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739";
const PAYMENT_AMOUNT = "20000000000"; // 20 CSPR for delegate mint
const TOKEN_ID = "502";

async function delegateMintCEP95() {
  console.log("🎯 Delegate Mint CEP-95 via Authority Mint V2\n");

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
  console.log("Authority Mint V2:", AUTHORITY_MINT_V2_HASH);
  console.log("PUBLIC CEP-95:", PUBLIC_CEP95_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("");

  // CEP-95 metadata format - List of Tuple2(String, String)
  const metadata = CLValueBuilder.list([
    CLValueBuilder.tuple2([
      CLValueBuilder.string("name"),
      CLValueBuilder.string(`Delegate Minted CEP-95 #${TOKEN_ID}`),
    ]),
    CLValueBuilder.tuple2([
      CLValueBuilder.string("symbol"),
      CLValueBuilder.string("DELEGATENFT"),
    ]),
    CLValueBuilder.tuple2([
      CLValueBuilder.string("token_uri"),
      CLValueBuilder.string(
        `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/${TOKEN_ID}/metadata.json`
      ),
    ]),
  ]);

  // Parse collection hash
  const collectionHashBytes = PUBLIC_CEP95_HASH.replace("hash-", "");

  // Create runtime args for Authority Mint V2's mint_cep95 function
  const runtimeArgs = RuntimeArgs.fromMap({
    collection_hash: CLValueBuilder.byteArray(
      Uint8Array.from(Buffer.from(collectionHashBytes, "hex"))
    ),
    to: CLValueBuilder.key(clPublicKey),
    token_id: CLValueBuilder.u256(TOKEN_ID),
    metadata: metadata,
  });

  // Create deploy
  const deployParams = new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME);

  const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
    Uint8Array.from(
      Buffer.from(AUTHORITY_MINT_V2_HASH.replace("hash-", ""), "hex")
    ),
    "mint_cep95", // NEW FUNCTION for CEP-95
    runtimeArgs
  );

  const payment = DeployUtil.standardPayment(PAYMENT_AMOUNT);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

  // Send deploy
  const client = new CasperClient(NODE_URL);
  console.log("📤 Sending delegate mint (CEP-95 format)...");
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Deploy submitted!");
  console.log("Deploy hash:", deployHash);
  console.log("");
  console.log("Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  // Wait for execution
  console.log("\n⏳ Waiting for execution (35s)...");
  await new Promise((resolve) => setTimeout(resolve, 35000));

  try {
    const result = await client.getDeploy(deployHash);
    const executionResult = result[1].execution_results[0].result;

    const proofData = {
      timestamp: new Date().toISOString(),
      deployHash: deployHash,
      method: "delegate_mint_cep95",
      authorityMint: AUTHORITY_MINT_V2_HASH,
      targetContract: PUBLIC_CEP95_HASH,
      tokenId: TOKEN_ID,
      executionResult: executionResult,
      explorerLink: `https://testnet.cspr.live/deploy/${deployHash}`,
    };

    if (executionResult.Success) {
      console.log("✅ SUCCESS!");
      proofData.status = "SUCCESS";
    } else {
      console.log("❌ FAILED:", executionResult);
      proofData.status = "FAILED";
      proofData.error = executionResult;
    }

    fs.writeFileSync(
      "/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/deployment-casper/DELEGATE-MINT-CEP95-V2-PROOF.json",
      JSON.stringify(proofData, null, 2)
    );

    console.log(
      "\n✅ Proof saved to deployment-casper/DELEGATE-MINT-CEP95-V2-PROOF.json"
    );
  } catch (error) {
    console.log("⚠️  Deploy still pending or error:", error.message);
  }
}

delegateMintCEP95().catch(console.error);
