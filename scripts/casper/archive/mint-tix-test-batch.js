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
const PUBLIC_CEP95_HASH =
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739";
const AUTHORITY_MINT_V2_HASH =
  "hash-187345749048e98e2ecbbc4acbc2221a04c6a121cc8c32ddf12aaa706d3f7ef2";

// Mint configuration
const MINTS = [
  { tokenId: "200", method: "direct", payment: "10000000000" },
  { tokenId: "201", method: "delegate", payment: "20000000000" },
  { tokenId: "202", method: "direct", payment: "10000000000" },
];

async function mintBatch() {
  console.log("🎨 Minting TIX-TEST NFT Batch\n");

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
  console.log("Authority Mint V2:", AUTHORITY_MINT_V2_HASH);
  console.log("");

  const client = new CasperClient(NODE_URL);
  const results = [];

  for (const mint of MINTS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(
      `🎯 Minting Token #${mint.tokenId} (${mint.method.toUpperCase()})`
    );
    console.log("=".repeat(60));

    // Create metadata
    const metadata = CLValueBuilder.list([
      CLValueBuilder.tuple2([
        CLValueBuilder.string("name"),
        CLValueBuilder.string("TIX-TEST"),
      ]),
      CLValueBuilder.tuple2([
        CLValueBuilder.string("symbol"),
        CLValueBuilder.string("TIXTEST"),
      ]),
      CLValueBuilder.tuple2([
        CLValueBuilder.string("token_uri"),
        CLValueBuilder.string(
          `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/${mint.tokenId}/metadata.json`
        ),
      ]),
    ]);

    let deploy;

    if (mint.method === "direct") {
      // Direct mint to PUBLIC CEP-95
      console.log("Method: Direct mint to PUBLIC CEP-95");

      const runtimeArgs = RuntimeArgs.fromMap({
        to: CLValueBuilder.key(clPublicKey),
        token_id: CLValueBuilder.u256(mint.tokenId),
        metadata: metadata,
      });

      const deployParams = new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME);
      const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(
          Buffer.from(PUBLIC_CEP95_HASH.replace("hash-", ""), "hex")
        ),
        "mint",
        runtimeArgs
      );
      const payment = DeployUtil.standardPayment(mint.payment);
      deploy = DeployUtil.makeDeploy(deployParams, session, payment);
    } else {
      // Delegate mint via Authority Mint V2
      console.log("Method: Delegate mint via Authority Mint V2");

      const collectionHashBytes = PUBLIC_CEP95_HASH.replace("hash-", "");
      const runtimeArgs = RuntimeArgs.fromMap({
        collection_hash: CLValueBuilder.byteArray(
          Uint8Array.from(Buffer.from(collectionHashBytes, "hex"))
        ),
        to: CLValueBuilder.key(clPublicKey),
        token_id: CLValueBuilder.u256(mint.tokenId),
        metadata: metadata,
      });

      const deployParams = new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME);
      const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(
          Buffer.from(AUTHORITY_MINT_V2_HASH.replace("hash-", ""), "hex")
        ),
        "mint_cep95",
        runtimeArgs
      );
      const payment = DeployUtil.standardPayment(mint.payment);
      deploy = DeployUtil.makeDeploy(deployParams, session, payment);
    }

    const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

    console.log("Payment:", mint.payment, "motes");
    console.log("📤 Sending deploy...");

    try {
      const deployHash = await client.putDeploy(signedDeploy);
      console.log("✅ Deploy submitted!");
      console.log("Deploy hash:", deployHash);
      console.log(
        "Explorer:",
        `https://testnet.cspr.live/deploy/${deployHash}`
      );

      results.push({
        tokenId: mint.tokenId,
        method: mint.method,
        deployHash: deployHash,
        status: "SUBMITTED",
        metadata: {
          name: "TIX-TEST",
          symbol: "TIXTEST",
          token_uri: `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/${mint.tokenId}/metadata.json`,
        },
      });

      // Wait 2 seconds between mints
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.log("❌ Error:", error.message);
      results.push({
        tokenId: mint.tokenId,
        method: mint.method,
        status: "FAILED",
        error: error.message,
      });
    }
  }

  // Save results
  console.log("\n" + "=".repeat(60));
  console.log("📊 BATCH MINT SUMMARY");
  console.log("=".repeat(60));
  console.log("");

  results.forEach((r) => {
    console.log(`Token #${r.tokenId} (${r.method}):`);
    console.log(`  Status: ${r.status}`);
    if (r.deployHash) {
      console.log(`  Deploy: ${r.deployHash}`);
    }
    console.log("");
  });

  const summaryFile =
    "/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/deployment-casper/TIX-TEST-BATCH-MINT.json";
  fs.writeFileSync(
    summaryFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        collection: PUBLIC_CEP95_HASH,
        packageHash:
          "contract-package-d5deb2361811d88a5ea274ce232fb400d676c187470b70b90242389a4d095ce9",
        mints: results,
      },
      null,
      2
    )
  );

  console.log("💾 Results saved to:", summaryFile);
  console.log("");
  console.log("⏳ Wait 1-2 minutes, then check status on explorer");
}

mintBatch().catch(console.error);
