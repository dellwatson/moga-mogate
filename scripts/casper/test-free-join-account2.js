const {
  CasperClient,
  CLValueBuilder,
  RuntimeArgs,
  DeployUtil,
  Keys,
  CLPublicKey,
} = require("casper-js-sdk");

const NODE_URL = "http://65.109.83.79:7777";
const CHAIN_NAME = "casper-test";

const RAFFLE_CONTRACT_HASH =
  "hash-4f976c4db1f467ef765fc561dcf45e9354cbf6195fb64beeba37dfea84e9d8d2";

const PAYMENT_AMOUNT = "50000000000"; // 50 CSPR gas

// Account 2 PEMs (must exist next to this script)
const ACCOUNT2_PUBLIC_PEM = "Account 2_public_key.pem";
const ACCOUNT2_SECRET_PEM = "Account 2_secret_key.pem";

function loadAccount2Keys() {
  const keyPair = Keys.Ed25519.parseKeyFiles(
    ACCOUNT2_PUBLIC_PEM,
    ACCOUNT2_SECRET_PEM
  );
  const clPublicKey = CLPublicKey.fromEd25519(keyPair.publicKey);
  const accountHex = clPublicKey.toHex();
  return { keyPair, clPublicKey, accountHex };
}

function hashToByteArray(hash) {
  return Uint8Array.from(Buffer.from(hash.replace("hash-", ""), "hex"));
}

async function sendStoredContractDeploy(
  clPublicKey,
  keyPair,
  entryPoint,
  args
) {
  const deployParams = new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME);
  const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
    hashToByteArray(RAFFLE_CONTRACT_HASH),
    entryPoint,
    args
  );
  const payment = DeployUtil.standardPayment(PAYMENT_AMOUNT);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
  const signed = DeployUtil.signDeploy(deploy, keyPair);
  const client = new CasperClient(NODE_URL);
  const deployHash = await client.putDeploy(signed);
  return deployHash;
}

async function freeJoinWithAccount2(raffleId, slotIds) {
  const { keyPair, clPublicKey, accountHex } = loadAccount2Keys();

  const slotsCl = slotIds.map((s) => CLValueBuilder.u64(s));
  const args = RuntimeArgs.fromMap({
    raffle_id: CLValueBuilder.string(raffleId),
    slot_ids: CLValueBuilder.list(slotsCl),
  });

  console.log(
    `\n🎟 FREE joining raffle ${raffleId} with slots: [${slotIds.join(", ")}]`
  );
  console.log("From Account2:", accountHex);

  const deployHash = await sendStoredContractDeploy(
    clPublicKey,
    keyPair,
    "free_join_raffle",
    args
  );

  console.log("✅ free_join_raffle (Account2) submitted:", deployHash);
  console.log("🔗 Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  return deployHash;
}

async function main() {
  const raffleId = "rwa-demo-1";
  const slots = [20, 21, 22, 23];
  const deployHash = await freeJoinWithAccount2(raffleId, slots);
  console.log("\n✅ Account2 free join done:", deployHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
