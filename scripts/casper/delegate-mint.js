/**
 * Delegate Mint - Mint NFT via Authority Mint V2 to PUBLIC CEP-95
 *
 * Usage: node delegate-mint.js <token-id>
 * Example: node delegate-mint.js 1000
 */

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
const PAYMENT_AMOUNT = "20000000000"; // 20 CSPR

// Get token ID from command line
const TOKEN_ID = Date.now().toString();
// const TOKEN_ID = process.argv[2];

if (!TOKEN_ID) {
  console.error("❌ Usage: node delegate-mint.js <token-id>");
  console.error("   Example: node delegate-mint.js 1000");
  process.exit(1);
}

async function delegateMint() {
  console.log("🎯 Delegate Mint via Authority Mint V2\n");

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

  console.log(
    publicKeyBytes,
    "publicKeyBytes",
    accountPublicKey,
    "accountPublicKey",
    clPublicKey,
    "clPublicKey"
  );

  console.log("Minter:", accountPublicKey);
  console.log("Authority Mint V2:", AUTHORITY_MINT_V2_HASH);
  console.log("PUBLIC CEP-95:", PUBLIC_CEP95_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("Payment:", PAYMENT_AMOUNT, "motes (20 CSPR)");
  console.log("");

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
        `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json`
      ),
    ]),
  ]);

  // Create runtime args for Authority Mint V2's mint_cep95 function
  const collectionHashBytes = PUBLIC_CEP95_HASH.replace("hash-", "");
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
    "mint_cep95",
    runtimeArgs
  );
  const payment = DeployUtil.standardPayment(PAYMENT_AMOUNT);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

  // Send deploy
  const client = new CasperClient(NODE_URL);
  console.log("📤 Sending delegate mint...");
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("✅ Deploy submitted!");
  console.log("Deploy hash:", deployHash);
  console.log("");
  console.log("🔗 Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);
  console.log("");
  console.log("📋 Token Details:");
  console.log("   Token ID:", TOKEN_ID);
  console.log("   Name: TIX-TEST");
  console.log("   Symbol: TIXTEST");
  console.log(
    "   Token URI:",
    `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/${TOKEN_ID}/metadata.json`
  );
  console.log("");
  console.log("⏳ Wait 1-2 minutes for execution");

  // Save result
  const result = {
    timestamp: new Date().toISOString(),
    method: "delegate_mint",
    authorityMint: AUTHORITY_MINT_V2_HASH,
    collection: PUBLIC_CEP95_HASH,
    tokenId: TOKEN_ID,
    deployHash: deployHash,
    explorerLink: `https://testnet.cspr.live/deploy/${deployHash}`,
    metadata: {
      name: "TIX-TEST",
      symbol: "TIXTEST",
      token_uri: `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/${TOKEN_ID}/metadata.json`,
    },
  };

  const resultFile = `/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/deployment-casper/mint-${TOKEN_ID}.json`;
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
  console.log("💾 Result saved to:", resultFile);
}

delegateMint().catch(console.error);
