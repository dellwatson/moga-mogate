/**
 * Offchain Worker for RWA Raffle
 * 
 * Responsibilities:
 * 1. Listen to program events (ThresholdReached, RefundTicketsRequested, WinnerSelected)
 * 2. Auto-draw: Call request_draw_arcium() when raffle is full
 * 3. Auto-refund: Call refund_batch() at deadline if not full
 * 4. MRFT minting: Mint compressed NFTs via Bubblegum on refund events
 * 5. Notifications: Email/push to winners and refund recipients
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  Commitment,
  Logs,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROGRAM_ID = new PublicKey(
  process.env.RWA_RAFFLE_PROGRAM_ID || "5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M"
);
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const COMMITMENT: Commitment = "confirmed";
const WORKER_KEYPAIR_PATH = process.env.WORKER_KEYPAIR_PATH || "~/.config/solana/id.json";

// Load worker keypair (for signing transactions)
let workerKeypair: Keypair;
try {
  const keypairData = JSON.parse(readFileSync(WORKER_KEYPAIR_PATH.replace("~", process.env.HOME || ""), "utf-8"));
  workerKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`✅ Loaded worker keypair: ${workerKeypair.publicKey.toBase58()}`);
} catch (error) {
  console.error(`❌ Failed to load worker keypair from ${WORKER_KEYPAIR_PATH}`);
  process.exit(1);
}

// ============================================================================
// EVENT TYPES (matching program events)
// ============================================================================

interface ThresholdReachedEvent {
  raffle: PublicKey;
  supply: bigint;
}

interface RefundTicketsRequestedEvent {
  raffle: PublicKey;
  owner: PublicKey;
  start: bigint;
  count: bigint;
}

interface WinnerSelectedEvent {
  raffle: PublicKey;
  winnerTicket: bigint;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleThresholdReached(
  connection: Connection,
  event: ThresholdReachedEvent
) {
  console.log(`\n🎯 ThresholdReached: Raffle ${event.raffle.toBase58()} is full!`);
  console.log(`   Supply: ${event.supply}`);

  // TODO: Call request_draw_arcium() to trigger Arcium MPC computation
  // For now, just log
  console.log(`   ⏳ TODO: Call request_draw_arcium() for raffle ${event.raffle.toBase58()}`);

  // In production:
  // const tx = await requestDrawArciumTx(connection, PROGRAM_ID, {
  //   organizer: workerKeypair.publicKey,
  //   raffle: event.raffle,
  //   computationOffset: 0n,
  // });
  // tx.sign([workerKeypair]);
  // const sig = await connection.sendRawTransaction(tx.serialize());
  // console.log(`   ✅ Draw requested: ${sig}`);
}

async function handleRefundTicketsRequested(
  connection: Connection,
  event: RefundTicketsRequestedEvent
) {
  console.log(`\n💸 RefundTicketsRequested: ${event.owner.toBase58()}`);
  console.log(`   Raffle: ${event.raffle.toBase58()}`);
  console.log(`   Tickets: ${event.start} - ${BigInt(event.start) + BigInt(event.count) - 1n} (${event.count} total)`);

  // TODO: Mint MRFT (compressed NFTs) via Bubblegum
  console.log(`   ⏳ TODO: Mint ${event.count} MRFT NFTs to ${event.owner.toBase58()}`);

  // In production:
  // for (let i = 0; i < Number(event.count); i++) {
  //   await mintCompressedNft(connection, {
  //     recipient: event.owner,
  //     collection: MRFT_COLLECTION_MINT,
  //     name: `MRFT #${BigInt(event.start) + BigInt(i)}`,
  //     symbol: "MRFT",
  //     uri: "https://...",
  //   });
  // }
  // console.log(`   ✅ Minted ${event.count} MRFT NFTs`);

  // TODO: Send notification
  console.log(`   📧 TODO: Send refund notification to ${event.owner.toBase58()}`);
}

async function handleWinnerSelected(
  connection: Connection,
  event: WinnerSelectedEvent
) {
  console.log(`\n🏆 WinnerSelected: Raffle ${event.raffle.toBase58()}`);
  console.log(`   Winning ticket: ${event.winnerTicket}`);

  // TODO: Find winner's wallet address from ticket PDA
  console.log(`   ⏳ TODO: Fetch winner's wallet from ticket PDA`);

  // TODO: Send notification
  console.log(`   📧 TODO: Send winner notification`);
}

// ============================================================================
// EVENT PARSING
// ============================================================================

function parseAnchorEvent(logs: string[]): { name: string; data: any } | null {
  // Anchor events are logged as base64-encoded data with "Program data: " prefix
  for (const log of logs) {
    if (log.includes("Program data: ")) {
      try {
        const dataStr = log.split("Program data: ")[1];
        const data = Buffer.from(dataStr, "base64");
        
        // First 8 bytes are the event discriminator
        const discriminator = data.subarray(0, 8);
        const eventData = data.subarray(8);

        // TODO: Use Anchor IDL to properly decode events
        // For now, we'll do basic pattern matching on discriminator
        
        // Event discriminators (computed from event name hash)
        // You can get these from the IDL or by logging them
        const THRESHOLD_REACHED_DISC = "threshold_reached"; // placeholder
        const REFUND_TICKETS_REQUESTED_DISC = "refund_tickets_requested"; // placeholder
        const WINNER_SELECTED_DISC = "winner_selected"; // placeholder

        // Basic decoding (replace with proper Anchor deserialization)
        return { name: "unknown", data: eventData };
      } catch (error) {
        console.error("Failed to parse event:", error);
      }
    }
  }
  return null;
}

// ============================================================================
// MAIN WORKER LOOP
// ============================================================================

async function main() {
  const connection = new Connection(RPC_URL, { commitment: COMMITMENT });

  console.log("🤖 RWA Raffle Worker Starting...");
  console.log(`   Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`   RPC URL: ${RPC_URL}`);
  console.log(`   Worker: ${workerKeypair.publicKey.toBase58()}`);
  console.log("");

  // Subscribe to program logs
  const subId = connection.onLogs(
    PROGRAM_ID,
    async (logs: Logs) => {
      try {
        // Parse events from logs
        const event = parseAnchorEvent(logs.logs);
        
        if (!event) {
          // No event found, skip
          return;
        }

        // Route to appropriate handler
        // TODO: Implement proper event discrimination and deserialization
        console.log(`📨 Event received: ${event.name}`);
        
        // For now, just log all events
        // In production, uncomment and implement proper routing:
        // if (event.name === "ThresholdReached") {
        //   await handleThresholdReached(connection, event.data);
        // } else if (event.name === "RefundTicketsRequested") {
        //   await handleRefundTicketsRequested(connection, event.data);
        // } else if (event.name === "WinnerSelected") {
        //   await handleWinnerSelected(connection, event.data);
        // }
      } catch (error) {
        console.error("Error handling logs:", error);
      }
    },
    COMMITMENT
  );

  console.log(`✅ Subscribed to program logs (subscription ID: ${subId})`);
  console.log("👂 Listening for events...\n");

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down worker...");
    connection.removeOnLogsListener(subId);
    process.exit(0);
  });
}

// ============================================================================
// HELPER FUNCTIONS (TODO: Implement)
// ============================================================================

// async function requestDrawArciumTx(
//   connection: Connection,
//   programId: PublicKey,
//   args: { organizer: PublicKey; raffle: PublicKey; computationOffset: bigint }
// ): Promise<Transaction> {
//   // Build request_draw_arcium instruction
//   // Return transaction
// }

// async function mintCompressedNft(
//   connection: Connection,
//   args: {
//     recipient: PublicKey;
//     collection: PublicKey;
//     name: string;
//     symbol: string;
//     uri: string;
//   }
// ): Promise<string> {
//   // Mint compressed NFT via Bubblegum
//   // Return signature
// }

// ============================================================================
// START WORKER
// ============================================================================

main().catch((error) => {
  console.error("❌ Worker error:", error);
  process.exit(1);
});
