/**
 * RWA Raffle demo script
 *
 * - Assumes the raffle contract is deployed (see ../deploy-rwa-raffle.sh)
 * - Hosts 3 raffles via unsafe_host_raffle
 * - Optionally joins one raffle to test payment + booking
 */

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

// ===== CONFIG =====

const NODE_URL = "http://65.109.83.79:7777";
const CHAIN_NAME = "casper-test";

// New deployed rwa_raffle_purse contract on testnet
// Named key: rwa_raffle_cspr
const RAFFLE_CONTRACT_HASH =
  "hash-4f976c4db1f467ef765fc561dcf45e9354cbf6195fb64beeba37dfea84e9d8d2";

// PUBLIC CEP-95 used by raffle to mint prizes
const PUBLIC_CEP95_HASH =
  "hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739";

// Payment for each host/join call (gas only, ticket price is transferred from source_purse)
const PAYMENT_AMOUNT = "100000000000"; // 100 CSPR

// Dev key used for demo (same pattern as delegate-mint.js)
const PRIVATE_KEY_HEX =
  "714ce7a284d20565c24791c4692ce8c246d6667159bd1cb799d42f9a327c8579";

// Optional: main purse URef of this account, to be used as source_purse when joining
// You can get it from account info on cspr.live or via RPC.
// Example: "uref-...-007"
const SOURCE_PURSE_UREF =
  "uref-00c640d622bc5d7aa037062bfc9cc5f10f19107455a4e7f9eadceea993886568-007";

// ===== HELPERS =====

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

// ===== HOST RAFFLE (unsafe) =====

async function hostRaffleUnsafe(
  id,
  totalSlots,
  maxPerAddress,
  pricePerSlotCSPR,
  autoClaim
) {
  const { keyPair, clPublicKey, accountPublicKey } = loadKeyPair();

  const collectionHashBytes = hashToByteArray(PUBLIC_CEP95_HASH);
  const pricePerSlotMotes = BigInt(pricePerSlotCSPR) * 1000000000n; // 1 CSPR = 1e9 motes

  const args = RuntimeArgs.fromMap({
    raffle_id: CLValueBuilder.string(id),
    total_slots: CLValueBuilder.u64(totalSlots),
    max_slots_per_address: CLValueBuilder.u64(maxPerAddress),
    price_per_slot: CLValueBuilder.u512(pricePerSlotMotes.toString()),
    metadata_uri: CLValueBuilder.string(
      `https://example.com/raffles/${id}/metadata.json`
    ),
    collection_hash: CLValueBuilder.byteArray(collectionHashBytes),
    premint_contract: CLValueBuilder.bool(false),
    premint: CLValueBuilder.bool(false),
    auto_claim: CLValueBuilder.bool(autoClaim),
    expires_at: CLValueBuilder.u512("0"), // no expiry for demo
  });

  console.log(`\n🎯 Hosting raffle ${id}`);
  console.log("Host:", accountPublicKey);

  const deployHash = await sendStoredContractDeploy(
    clPublicKey,
    keyPair,
    RAFFLE_CONTRACT_HASH,
    "unsafe_host_raffle",
    args
  );

  console.log("✅ unsafe_host_raffle submitted:", deployHash);
  console.log("🔗 Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  return deployHash;
}

// ===== JOIN RAFFLE (optional test) =====

async function joinRaffle(id, slotIds) {
  if (!SOURCE_PURSE_UREF.startsWith("uref-")) {
    console.log("⚠️ SOURCE_PURSE_UREF not set, skipping join test.");
    return;
  }

  const { keyPair, clPublicKey, accountPublicKey } = loadKeyPair();

  const uref = CLURef.fromFormattedStr(SOURCE_PURSE_UREF);

  const slotsCl = slotIds.map((s) => CLValueBuilder.u64(s));
  const args = RuntimeArgs.fromMap({
    raffle_id: CLValueBuilder.string(id),
    slot_ids: CLValueBuilder.list(slotsCl),
    source_purse: uref,
  });

  console.log(`\n🎟 Joining raffle ${id} with slots: [${slotIds.join(", ")}]`);
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

// ===== QUICK VIEW: get_raffle_load =====

async function getRaffleLoad(id) {
  const client = new CasperClient(NODE_URL);
  const stateRootHash = await client.nodeClient.getStateRootHash();

  const key = RAFFLE_CONTRACT_HASH.replace("hash-", "");

  const result = await client.nodeClient.getBlockState(
    stateRootHash,
    `hash-${key}`,
    [CONTRACT_NAME]
  );

  // For simplicity we rely on the frontend/backends using get_raffle_load
  // via RPC (casper-client or dedicated viewer). This placeholder is here
  // to remind you; implement full call if you want direct JS view.
  console.log(
    "ℹ️ For quick view, call get_raffle_load via RPC or casper-client."
  );
}

// ===== MAIN =====

async function main() {
  if (RAFFLE_CONTRACT_HASH.includes("REPLACE")) {
    console.error(
      "❌ Please set RAFFLE_CONTRACT_HASH in rwa-raffle-demo.js first."
    );
    process.exit(1);
  }

  console.log("RWA Raffle demo using contract:", RAFFLE_CONTRACT_HASH);

  // 1) Host 3 raffles
  await hostRaffleUnsafe("rwa-demo-1", 200, 10, 30, true); // auto-claim
  await hostRaffleUnsafe("rwa-demo-2", 100, 5, 10, false); // self-claim
  await hostRaffleUnsafe("rwa-demo-3", 50, 3, 5, true);

  // 2) Optionally join the first raffle to test payments & booking
  await joinRaffle("rwa-demo-1", [1, 10, 200]);

  console.log("\n✅ Demo finished. Check deploys on testnet explorer.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
