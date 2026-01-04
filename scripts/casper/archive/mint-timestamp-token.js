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
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739";
const TOKEN_ID = "1767494711"; // Your timestamp-based token ID
const PAYMENT_AMOUNT = "10000000000"; // 10 CSPR

async function mintTimestampToken() {
  console.log("🎯 Minting Token with Timestamp ID\n");

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
  console.log("Contract:", PUBLIC_CEP95_HASH);
  console.log("Token ID:", TOKEN_ID, "(U256 - supports huge numbers!)");
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
        `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/${TOKEN_ID}/metadata.json`
      ),
    ]),
  ]);

  const runtimeArgs = RuntimeArgs.fromMap({
    to: CLValueBuilder.key(clPublicKey),
    token_id: CLValueBuilder.u256(TOKEN_ID),
    metadata: metadata,
  });

  const deployParams = new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME);
  const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
    Uint8Array.from(Buffer.from(PUBLIC_CEP95_HASH.replace("hash-", ""), "hex")),
    "mint",
    runtimeArgs
  );
  const payment = DeployUtil.standardPayment(PAYMENT_AMOUNT);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

  const client = new CasperClient(NODE_URL);
  console.log("📤 Sending mint deploy...");
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
  console.log("✅ U256 can handle token IDs up to 2^256 - 1");
  console.log("   Your token ID (1767494711) is perfectly valid!");
}

mintTimestampToken().catch(console.error);
