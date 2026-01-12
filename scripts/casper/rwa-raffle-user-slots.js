const { CasperClient } = require("casper-js-sdk");

const NODE_URL = "http://65.109.83.79:7777";
const RAFFLE_CONTRACT_HASH =
  "hash-e883be023514a1e4e781c2640368ec58bcc2c0bd9d2e85c9124634a78869f1f3";

const DICT_USER_SLOTS = "raffle_user_slots";

function usage() {
  console.log(
    "Usage: node scripts/casper/rwa-raffle-user-slots.js <raffle_id> <account_hash>\n"
  );
  console.log("Example:");
  console.log(
    "  node scripts/casper/rwa-raffle-user-slots.js rwa-demo-1 account-hash-1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8"
  );
}

async function main() {
  const raffleId = process.argv[2];
  const accountHash = process.argv[3];

  if (!raffleId || !accountHash) {
    usage();
    process.exit(1);
  }

  if (!accountHash.startsWith("account-hash-")) {
    console.error("❌ account_hash must start with 'account-hash-'");
    process.exit(1);
  }

  const client = new CasperClient(NODE_URL);

  console.log("RWA Raffle user slots viewer");
  console.log("Node:", NODE_URL);
  console.log("Contract:", RAFFLE_CONTRACT_HASH);
  console.log("Raffle:", raffleId);
  console.log("Account:", accountHash);

  const stateRootHash = await client.nodeClient.getStateRootHash();

  // Dictionary item key format is: "<raffle_id>|<owner_key_formatted>"
  const dictKey = `${raffleId}|${accountHash}`;

  const result = await client.nodeClient.getDictionaryItemByName(
    stateRootHash,
    RAFFLE_CONTRACT_HASH,
    DICT_USER_SLOTS,
    dictKey
  );

  const stored = result?.stored_value;
  const parsed = stored && stored.CLValue ? stored.CLValue.parsed : [];

  const slots = Array.isArray(parsed) ? parsed.map((v) => Number(v)) : [];

  const summary = {
    raffleId,
    accountHash,
    slotCount: slots.length,
    slots,
  };

  console.log("\nSummary:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
