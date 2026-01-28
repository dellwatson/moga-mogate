/**
 * Unsafe Join Raffle Script (SOL-based multi_raffle)
 *
 * Uses the unsafe_join_raffle instruction to pay SOL into the
 * per-raffle treasury PDA and claim specific slots.
 *
 * Usage:
 *   bun run scripts/unsafe-join-raffle.ts <raffle-id> <slot-list> <amount-sol>
 *
 * Examples:
 *   bun run scripts/unsafe-join-raffle.ts raffle-123 "1,2,3" 0.5
 *
 * Env:
 *   SOLANA_NETWORK   - devnet | mainnet (default devnet)
 *   SOLANA_RPC_URL   - custom RPC (optional)
 *   WALLET_PATH      - keypair json (default ~/.config/solana/id.json)
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
  buildUnsafeJoinRaffleIx,
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

const RAFFLE_ID = process.argv[2];
const SLOT_LIST = process.argv[3];
const AMOUNT_SOL_STR = process.argv[4];

function parseSolToLamports(input: string): bigint {
  if (!input.includes(".")) {
    return BigInt(input) * 1_000_000_000n;
  }
  const [whole, fracRaw] = input.split(".");
  const frac = (fracRaw || "").padEnd(9, "0").slice(0, 9);
  const wholeLamports = BigInt(whole || "0") * 1_000_000_000n;
  const fracLamports = BigInt(frac);
  return wholeLamports + fracLamports;
}

async function main() {
  if (!RAFFLE_ID || !SLOT_LIST || !AMOUNT_SOL_STR) {
    console.error(
      "Usage: bun run scripts/unsafe-join-raffle.ts <raffle-id> <slot-list> <amount-sol>",
    );
    console.error(
      'Example: bun run scripts/unsafe-join-raffle.ts raffle-123 "1,2,3" 0.5',
    );
    process.exit(1);
  }

  const slotIds = SLOT_LIST.split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10));

  if (!slotIds.length || slotIds.some((n) => !Number.isFinite(n) || n <= 0)) {
    throw new Error(
      "Invalid slot-list. Expected comma-separated positive integers, e.g. '1,2,3'",
    );
  }

  const amountLamports = parseSolToLamports(AMOUNT_SOL_STR);

  console.log("\n🧩 Unsafe Join Raffle");
  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log("Program:", MULTI_RAFFLE_PROGRAM_ID.toBase58());
  console.log("Raffle ID:", RAFFLE_ID);
  console.log("Slots:", slotIds.join(", "));
  console.log(
    "Amount:",
    AMOUNT_SOL_STR,
    "SOL (",
    amountLamports.toString(),
    "lamports )",
  );

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

  const beforeTreasury = await connection.getBalance(treasuryPda);
  console.log("\n💰 Treasury Balance (before):", beforeTreasury / 1e9, "SOL");

  const ix = buildUnsafeJoinRaffleIx({
    payer: walletKeypair.publicKey,
    config: configPda,
    raffleId: RAFFLE_ID,
    slotIds,
    amountLamports,
  });

  const latest = await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: walletKeypair.publicKey,
    recentBlockhash: latest.blockhash,
  }).add(ix);

  tx.sign(walletKeypair);

  console.log("\n🚀 Sending unsafe_join_raffle transaction...");
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

  console.log("\n✅ unsafe_join_raffle confirmed");

  const raffleAcc = await fetchRaffleAccount(connection, rafflePda);
  const userAcc = await fetchUserRaffleAccount(connection, userRafflePda);
  const afterTreasury = await connection.getBalance(treasuryPda);

  console.log("\n📋 Raffle Account:");
  console.dir(raffleAcc, { depth: null });

  console.log("\n📋 UserRaffle Account (this user):");
  console.dir(userAcc, { depth: null });

  console.log("\n💰 Treasury Balance (after):", afterTreasury / 1e9, "SOL");

  console.log("\n✨ Done.");
}

main().catch((err) => {
  console.error("\n❌ Error in unsafe-join-raffle:");
  console.error(err);
  process.exit(1);
});
