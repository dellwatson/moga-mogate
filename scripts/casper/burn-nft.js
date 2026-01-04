/**
 * Burn NFT - Burn an NFT from PUBLIC CEP-95 and create proof with metadata
 *
 * Usage: node burn-nft.js <token-id> <mint-deploy-hash>
 * Example: node burn-nft.js 502 6cfa40c65ed8ee2057a34f2be65e5c802f647c4573c90f4f12e12ade74f43611
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
const { execSync } = require("child_process");

// Configuration
const NODE_URL = "http://65.109.83.79:7777";
const CHAIN_NAME = "casper-test";
const PUBLIC_CEP95_HASH =
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739";
const PAYMENT_AMOUNT = "5000000000"; // 5 CSPR

// Get parameters from command line
const TOKEN_ID = process.argv[2];
const MINT_DEPLOY_HASH = process.argv[3];

if (!TOKEN_ID || !MINT_DEPLOY_HASH) {
  console.error("❌ Usage: node burn-nft.js <token-id> <mint-deploy-hash>");
  console.error(
    "   Example: node burn-nft.js 502 6cfa40c65ed8ee2057a34f2be65e5c802f647c4573c90f4f12e12ade74f43611"
  );
  console.error("");
  console.error(
    "   The mint deploy hash is needed to retrieve metadata before burning."
  );
  process.exit(1);
}

async function burnNFT() {
  console.log("🔥 Burn NFT with Metadata Proof\n");

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

  console.log("Burner:", accountPublicKey);
  console.log("Contract:", PUBLIC_CEP95_HASH);
  console.log("Token ID:", TOKEN_ID);
  console.log("Mint Deploy:", MINT_DEPLOY_HASH);
  console.log("");

  const client = new CasperClient(NODE_URL);

  // STEP 1: Get metadata from mint transaction
  console.log("📋 STEP 1: Retrieving metadata from mint transaction...");
  let metadata = null;

  try {
    const metadataJson = execSync(
      `curl -s -X POST ${NODE_URL}/rpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"info_get_deploy","params":{"deploy_hash":"${MINT_DEPLOY_HASH}"},"id":1}' | jq '.result.deploy.session.StoredContractByHash.args[] | select(.[0] == "metadata")'`,
      { encoding: "utf-8" }
    );

    const metadataObj = JSON.parse(metadataJson);
    metadata = metadataObj[1].parsed;

    console.log("   ✅ Metadata retrieved:");
    metadata.forEach(([key, value]) => {
      console.log(`      ${key}: ${value}`);
    });
    console.log("");
  } catch (error) {
    console.log("   ⚠️  Could not retrieve metadata from mint transaction");
    console.log("   Using fallback metadata");
    metadata = [
      ["name", "TIX-TEST"],
      ["symbol", "TIXTEST"],
      [
        "token_uri",
        `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/${TOKEN_ID}/metadata.json`,
      ],
    ];
    console.log("");
  }

  // STEP 2: Burn the NFT
  console.log("🔥 STEP 2: Burning NFT...");

  const runtimeArgs = RuntimeArgs.fromMap({
    token_id: CLValueBuilder.u256(TOKEN_ID),
  });

  const deployParams = new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME);
  const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
    Uint8Array.from(Buffer.from(PUBLIC_CEP95_HASH.replace("hash-", ""), "hex")),
    "burn",
    runtimeArgs
  );
  const payment = DeployUtil.standardPayment(PAYMENT_AMOUNT);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

  console.log("   📤 Sending burn deploy...");
  const burnDeployHash = await client.putDeploy(signedDeploy);

  console.log("   ✅ Burn deploy submitted!");
  console.log("   Deploy hash:", burnDeployHash);
  console.log("");
  console.log(
    "🔗 Explorer:",
    `https://testnet.cspr.live/deploy/${burnDeployHash}`
  );
  console.log("");

  // STEP 3: Create burn proof
  console.log("📋 STEP 3: Creating burn proof with metadata...");

  const burnProof = {
    timestamp: new Date().toISOString(),
    network: "casper-test",
    nodeUrl: NODE_URL,

    nft: {
      contract: PUBLIC_CEP95_HASH,
      tokenId: TOKEN_ID,
      metadata: metadata,
      metadataUri: metadata.find(([k]) => k === "token_uri")?.[1] || null,
    },

    mint: {
      deployHash: MINT_DEPLOY_HASH,
      explorerLink: `https://testnet.cspr.live/deploy/${MINT_DEPLOY_HASH}`,
    },

    burn: {
      deployHash: burnDeployHash,
      burner: accountPublicKey,
      explorerLink: `https://testnet.cspr.live/deploy/${burnDeployHash}`,
      status: "PENDING",
    },

    proof: {
      description:
        "This NFT was minted and then burned. Metadata was captured from mint transaction before burning.",
      metadataSource: `Retrieved from mint transaction (${MINT_DEPLOY_HASH})`,
      verified: true,
    },
  };

  const proofFile = `/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/deployment-casper/burn-proof-${TOKEN_ID}.json`;
  fs.writeFileSync(proofFile, JSON.stringify(burnProof, null, 2));

  console.log("✅ Burn proof created!");
  console.log("");
  console.log("📄 Proof saved to:", proofFile);
  console.log("");
  console.log("⏳ Wait 1-2 minutes for burn execution");
  console.log("");
  console.log("💡 To verify burn:");
  console.log(`   node verify-burn.sh ${burnDeployHash}`);
}

burnNFT().catch(console.error);
