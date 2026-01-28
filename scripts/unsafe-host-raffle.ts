/**
 * Unsafe Host Raffle Script (SOL-based multi_raffle)
 *
 * Uses the unsafe_host_raffle instruction to create a raffle without
 * any off-chain permit. This is meant for dev/testing.
 *
 * Usage:
 *   bun run scripts/unsafe-host-raffle.ts <raffle-id> <collection-mint> <metadata-uri>
 *     [total-slots=10] [max-slots-per-address=5] [expires-in-seconds=3600]
 *
 * Env:
 *   SOLANA_NETWORK   - devnet | mainnet (default devnet)
 *   SOLANA_RPC_URL   - custom RPC (optional)
 *   WALLET_PATH      - keypair json (default ~/.config/solana/id.json)
 *   RAFFLE_PRIZE_TYPE   - u8 prize_type (default 1)
 *   RAFFLE_PRIZE_AMOUNT - u64 (as string, default "1")
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import {
  MULTI_RAFFLE_PROGRAM_ID,
  deriveConfigPda,
  deriveRafflePda,
  deriveSlotsPda,
  deriveUserRafflePda,
  deriveTreasuryPda,
  buildUnsafeHostRaffleIx,
  fetchRaffleAccount,
  fetchUserRaffleAccount,
} from "../ts-sdk/src/multiRaffle";

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME || "~", ".config/solana/id.json");

// CLI args
const RAFFLE_ID = process.argv[2] || `raffle-${Date.now()}`;
const COLLECTION_MINT_STR = process.argv[3];
const METADATA_URI =
  process.argv[4] || "https://example.com/mogate-raffle.json";

const TOTAL_SLOTS = parseInt(
  process.argv[5] || process.env.RAFFLE_TOTAL_SLOTS || "10",
  10,
);
const MAX_SLOTS_PER_ADDRESS = parseInt(
  process.argv[6] || process.env.RAFFLE_MAX_SLOTS_PER_ADDRESS || "5",
  10,
);
const EXPIRES_IN_SECONDS = parseInt(
  process.argv[7] || process.env.RAFFLE_EXPIRES_IN_SECS || "3600",
  10,
);

const PRIZE_TYPE = parseInt(process.env.RAFFLE_PRIZE_TYPE || "1", 10); // default SPL-type prize
const PRIZE_AMOUNT = BigInt(process.env.RAFFLE_PRIZE_AMOUNT || "1");
const AUTO_DRAW = (process.env.RAFFLE_AUTO_DRAW ?? "true") === "true";
const AUTO_CLAIM = (process.env.RAFFLE_AUTO_CLAIM ?? "false") === "true";

async function main() {
  if (!COLLECTION_MINT_STR) {
    console.error(
      "Usage: bun run scripts/unsafe-host-raffle.ts <raffle-id> <collection-mint> <metadata-uri> [total-slots] [max-slots-per-address] [expires-in-seconds]",
    );
    process.exit(1);
  }

  const collectionMint = new PublicKey(COLLECTION_MINT_STR);

  console.log("\n🧩 Unsafe Host Raffle");
  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log("Program:", MULTI_RAFFLE_PROGRAM_ID.toBase58());
  console.log("Raffle ID:", RAFFLE_ID);
  console.log("Collection Mint:", collectionMint.toBase58());
  console.log("Metadata URI:", METADATA_URI);
  console.log("Total Slots:", TOTAL_SLOTS);
  console.log("Max Slots / Address:", MAX_SLOTS_PER_ADDRESS);
  console.log("Expires in (seconds):", EXPIRES_IN_SECONDS);
  console.log();

  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
  );

  console.log("Payer:", walletKeypair.publicKey.toBase58());

  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log("Payer Balance:", balance / 1e9, "SOL");

  const [configPda] = deriveConfigPda(MULTI_RAFFLE_PROGRAM_ID);
  const [rafflePda] = deriveRafflePda(RAFFLE_ID, MULTI_RAFFLE_PROGRAM_ID);
  const [slotsPda] = deriveSlotsPda(rafflePda, MULTI_RAFFLE_PROGRAM_ID);
  const [userRafflePda] = deriveUserRafflePda(
    rafflePda,
    walletKeypair.publicKey,
    MULTI_RAFFLE_PROGRAM_ID,
  );
  const [treasuryPda] = deriveTreasuryPda(rafflePda, MULTI_RAFFLE_PROGRAM_ID);

  console.log("\n📍 Derived PDAs:");
  console.log("  Config:", configPda.toBase58());
  console.log("  Raffle:", rafflePda.toBase58());
  console.log("  Slots:", slotsPda.toBase58());
  console.log("  UserRaffle:", userRafflePda.toBase58());
  console.log("  Treasury:", treasuryPda.toBase58());

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = BigInt(now + EXPIRES_IN_SECONDS);

  const ix = buildUnsafeHostRaffleIx({
    payer: walletKeypair.publicKey,
    config: configPda,
    raffleId: RAFFLE_ID,
    totalSlots: TOTAL_SLOTS,
    maxSlotsPerAddress: MAX_SLOTS_PER_ADDRESS,
    metadataUri: METADATA_URI,
    collection: collectionMint,
    premintContract: false,
    premint: true,
    prizeType: PRIZE_TYPE,
    prizeAmount: PRIZE_AMOUNT,
    autoDraw: AUTO_DRAW,
    autoClaim: AUTO_CLAIM,
    expiresAt,
  });

  const latest = await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: walletKeypair.publicKey,
    recentBlockhash: latest.blockhash,
  }).add(ix);

  tx.sign(walletKeypair);

  console.log("\n🚀 Sending unsafe_host_raffle transaction...");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  console.log("Signature:", sig);
  console.log(
    `Explorer: https://explorer.solana.com/tx/${sig}?cluster=${NETWORK}`,
  );

  await connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );

  console.log("\n✅ unsafe_host_raffle confirmed");

  const raffleAcc = await fetchRaffleAccount(connection, rafflePda);
  const userAcc = await fetchUserRaffleAccount(connection, userRafflePda);
  const treasuryBalance = await connection.getBalance(treasuryPda);

  console.log("\n📋 Raffle Account:");
  console.dir(raffleAcc, { depth: null });

  console.log("\n📋 UserRaffle Account (host):");
  console.dir(userAcc, { depth: null });

  console.log("\n💰 Treasury Balance:", treasuryBalance / 1e9, "SOL");

  console.log("\n✨ Done. Use unsafe-join-raffle.ts to join this raffle.");
}

main().catch((err) => {
  console.error("\n❌ Error in unsafe-host-raffle:");
  console.error(err);
  process.exit(1);
});
