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
const PRIVATE_KEY_HEX =
  "714ce7a284d20565c24791c4692ce8c246d6667159bd1cb799d42f9a327c8579";

function loadKeyPair() {
  const privateKeyBytes = Uint8Array.from(Buffer.from(PRIVATE_KEY_HEX, "hex"));
  const publicKeyBytes = Keys.Secp256K1.privateToPublicKey(privateKeyBytes);
  const keyPair = Keys.Secp256K1.parseKeyPair(
    publicKeyBytes,
    privateKeyBytes,
    "raw"
  );
  const accountPublicKey = Keys.Secp256K1.accountHex(publicKeyBytes);
  const clPublicKey = CLPublicKey.fromHex(accountPublicKey);
  return { keyPair, clPublicKey, accountPublicKey };
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

async function freeJoin(raffleId, slotIds) {
  const { keyPair, clPublicKey, accountPublicKey } = loadKeyPair();

  const slotsCl = slotIds.map((s) => CLValueBuilder.u64(s));
  const args = RuntimeArgs.fromMap({
    raffle_id: CLValueBuilder.string(raffleId),
    slot_ids: CLValueBuilder.list(slotsCl),
  });

  console.log(
    `\n🎟 FREE joining raffle ${raffleId} with slots: [${slotIds.join(", ")}]`
  );
  console.log("From:", accountPublicKey);

  const deployHash = await sendStoredContractDeploy(
    clPublicKey,
    keyPair,
    "free_join_raffle",
    args
  );

  console.log("✅ free_join_raffle submitted:", deployHash);
  console.log("🔗 Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  return deployHash;
}

async function main() {
  const raffleId = "rwa-demo-1";
  // Additional slots for Account 1 (we already booked [5, 6])
  const slots1 = [7, 8, 9, 10];
  const slots2 = [11, 12, 13, 14];

  const h1 = await freeJoin(raffleId, slots1);
  console.log("\n✅ Free join 1 done:", h1);

  const h2 = await freeJoin(raffleId, slots2);
  console.log("\n✅ Free join 2 done:", h2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
