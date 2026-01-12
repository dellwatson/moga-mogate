const {
  CasperClient,
  CLValueBuilder,
  RuntimeArgs,
  DeployUtil,
  Keys,
  CLPublicKey,
  CLURef,
} = require("casper-js-sdk");
const fs = require("fs");

const NODE_URL = "http://65.109.83.79:7777";
const CHAIN_NAME = "casper-test";
const RAFFLE_CONTRACT_HASH =
  "hash-8275dcbe006bd65568d33092b01d23a1b3383191e089900e8ba0c197967ae76f";
const PUBLIC_CEP95_HASH =
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739";
const PAYMENT_AMOUNT = "100000000000"; // 100 CSPR gas
const PRIVATE_KEY_HEX =
  "714ce7a284d20565c24791c4692ce8c246d6667159bd1cb799d42f9a327c8579";
const SOURCE_PURSE_UREF =
  "uref-00c640d622bc5d7aa037062bfc9cc5f10f19107455a4e7f9eadceea993886568-007";

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
  contractHash,
  entryPoint,
  args
) {
  const deployParams = new DeployUtil.DeployParams(clPublicKey, CHAIN_NAME);
  const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
    hashToByteArray(contractHash),
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

async function hostLowPriceRaffle() {
  const { keyPair, clPublicKey } = loadKeyPair();
  const raffleId = "low-price-" + Date.now();
  const collectionHashBytes = hashToByteArray(PUBLIC_CEP95_HASH);

  const args = RuntimeArgs.fromMap({
    raffle_id: CLValueBuilder.string(raffleId),
    total_slots: CLValueBuilder.u64(50),
    max_slots_per_address: CLValueBuilder.u64(10),
    price_per_slot: CLValueBuilder.u512("1000000000"), // 1 CSPR per slot
    metadata_uri: CLValueBuilder.string(
      "https://example.com/nft/metadata.json"
    ),
    collection_hash: CLValueBuilder.byteArray(collectionHashBytes),
    premint_contract: CLValueBuilder.bool(false),
    premint: CLValueBuilder.bool(false),
    auto_claim: CLValueBuilder.bool(false),
    expires_at: CLValueBuilder.u512("9999999999999"), // Far future
  });

  console.log(`\n🎯 Hosting LOW PRICE raffle: ${raffleId}`);
  console.log("Price per slot: 1 CSPR");

  const deployHash = await sendStoredContractDeploy(
    clPublicKey,
    keyPair,
    RAFFLE_CONTRACT_HASH,
    "unsafe_host_raffle",
    args
  );

  console.log("✅ Host deploy:", deployHash);
  console.log("🔗 Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);
  return { raffleId, deployHash };
}

async function joinRaffle(raffleId, slotIds) {
  const { keyPair, clPublicKey, accountPublicKey } = loadKeyPair();
  const uref = CLURef.fromFormattedStr(SOURCE_PURSE_UREF);

  const slotsCl = slotIds.map((s) => CLValueBuilder.u64(s));
  const args = RuntimeArgs.fromMap({
    raffle_id: CLValueBuilder.string(raffleId),
    slot_ids: CLValueBuilder.list(slotsCl),
    source_purse: uref,
  });

  console.log(
    `\n🎟 Joining raffle ${raffleId} with slots: [${slotIds.join(", ")}]`
  );
  console.log("From:", accountPublicKey);

  const deployHash = await sendStoredContractDeploy(
    clPublicKey,
    keyPair,
    RAFFLE_CONTRACT_HASH,
    "join_raffle",
    args
  );

  console.log("✅ join_raffle submitted:", deployHash);
  console.log("🔗 Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  return deployHash;
}

async function main() {
  console.log("=== LOW PRICE RAFFLE TEST ===");
  console.log("Testing with 1 CSPR per slot instead of 30 CSPR");
  console.log("Gas payment: 100 CSPR\n");

  // Host a low-price raffle
  const { raffleId } = await hostLowPriceRaffle();

  console.log("\n⏳ Waiting 40 seconds for host to finalize...");
  await new Promise((resolve) => setTimeout(resolve, 40000));

  // Join with 2 slots (total cost: 2 CSPR)
  await joinRaffle(raffleId, [1, 2]);

  console.log("\n✅ Test complete. Check deploys on explorer.");
}

main().catch(console.error);
