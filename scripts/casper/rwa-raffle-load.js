const { CasperClient } = require("casper-js-sdk");

const NODE_URL = "http://65.109.83.79:7777";
const RAFFLE_CONTRACT_HASH =
  "hash-e883be023514a1e4e781c2640368ec58bcc2c0bd9d2e85c9124634a78869f1f3";

// casper-js-sdk's getDictionaryItemByName expects the raw hex hash (no "hash-" prefix)
const RAFFLE_CONTRACT_HASH_RAW = RAFFLE_CONTRACT_HASH.replace("hash-", "");

const DICT_TOTAL_SLOTS = "raffle_total_slots";
const DICT_SOLD_SLOTS = "raffle_sold_slots";
const DICT_STATUS = "raffle_status";

function usage() {
  console.log("Usage: node scripts/casper/rwa-raffle-load.js <raffle_id>\n");
}

async function getDictionaryValue(client, stateRootHash, dictName, itemKey) {
  const result = await client.nodeClient.getDictionaryItemByName(
    stateRootHash,
    RAFFLE_CONTRACT_HASH_RAW,
    dictName,
    itemKey
  );

  const stored = result?.stored_value;
  if (!stored || !stored.CLValue) {
    return null;
  }

  return stored.CLValue.parsed;
}

async function main() {
  const raffleId = process.argv[2];
  if (!raffleId) {
    usage();
    process.exit(1);
  }

  const client = new CasperClient(NODE_URL);

  console.log("RWA Raffle load viewer");
  console.log("Node:", NODE_URL);
  console.log("Contract:", RAFFLE_CONTRACT_HASH);
  console.log("Raffle:", raffleId);

  const stateRootHash = await client.nodeClient.getStateRootHash();

  const totalSlots = await getDictionaryValue(
    client,
    stateRootHash,
    DICT_TOTAL_SLOTS,
    raffleId
  );
  if (totalSlots === null) {
    console.error("❌ Raffle not found (no total_slots entry)");
    process.exit(1);
  }

  const soldSlots =
    (await getDictionaryValue(
      client,
      stateRootHash,
      DICT_SOLD_SLOTS,
      raffleId
    )) || 0;

  const status =
    (await getDictionaryValue(client, stateRootHash, DICT_STATUS, raffleId)) ??
    0;

  const available = Number(totalSlots) - Number(soldSlots);

  const statusLabel =
    status === 0
      ? "OPEN"
      : status === 1
      ? "FILLED"
      : status === 2
      ? "DRAWN"
      : status === 3
      ? "CANCELLED"
      : `UNKNOWN(${status})`;

  const summary = {
    raffleId,
    totalSlots: Number(totalSlots),
    soldSlots: Number(soldSlots),
    availableSlots: available,
    status,
    statusLabel,
  };

  console.log("\nSummary:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
