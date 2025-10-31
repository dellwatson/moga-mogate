// Minimal offchain worker stub: listens for RandomnessRequested and settles draw (dev only)
// Requires: bun (runtime), @solana/web3.js (install in your environment)

import { Connection, PublicKey, LogsCallback, Commitment } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("RwaRafLe1111111111111111111111111111111111111");
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const COMMITMENT: Commitment = "confirmed";

async function main() {
  const connection = new Connection(RPC_URL, { commitment: COMMITMENT });

  const subId = connection.onLogs(
    PROGRAM_ID,
    async (logs) => {
      // TODO: parse program logs for `RandomnessRequested` event (Anchor event prefix)
      // Then compute winner in [1..required_tickets] and send settle_draw tx
      // This is a placeholder; real flow will use Arcium MPC and callback.
      console.log("program logs:", logs.logs.join("\n"));
    },
    COMMITMENT,
  );

  console.log("worker started. subscription:", await subId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
