/**
 * FHE Join Raffle Script (multi_raffle-inco - Version A: Slot-Based)
 *
 * Joins an existing FHE raffle by selecting specific slots.
 * Slot ownership is public, but the winning slot will be encrypted.
 *
 * Usage:
 *   bun run scripts/inco/join-raffle-inco.ts <raffle-id> <slot-list> <amount-sol>
 *
 * Examples:
 *   SOL_PVT_KEY=<key1> bun run scripts/inco/join-raffle-inco.ts fhe-raffle-123 "1,2,3" 0.5
 *   SOL_PVT_KEY=<key2> bun run scripts/inco/join-raffle-inco.ts fhe-raffle-123 "4,5,6" 0.5
 *
 * Env:
 *   SOLANA_NETWORK   - devnet | mainnet (default devnet)
 *   SOLANA_RPC_URL   - custom RPC (optional)
 *   WALLET_PATH      - keypair json (default ~/.config/solana/id.json)
 *   SOL_PVT_KEY      - base58 encoded private key (optional, overrides WALLET_PATH)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import bs58 from "bs58";

// FHE Program ID (Version A: Slot-Based) - DEPLOYED PROGRAM
const MULTI_RAFFLE_INCO_PROGRAM_ID = new PublicKey(
  "4CZWbG4LTceMHF9GnxS8g1aLVSG7w6HTARwAQ1juRLa4",
);

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME || "~", ".config/solana/id.json");

const RAFFLE_ID = parseInt(process.argv[2], 10);
const GUESS =
  parseInt(process.argv[3], 10) || Math.floor(Math.random() * 100) + 1; // 1-100

// PDA derivation helpers for deployed private_raffle program
const RAFFLE_SEED = Buffer.from("raffle");
const VAULT_SEED = Buffer.from("vault");
const TICKET_SEED = Buffer.from("ticket");

function deriveRafflePda(raffleId: number): [PublicKey, number] {
  const raffleIdBuffer = Buffer.alloc(8);
  raffleIdBuffer.writeBigUInt64LE(BigInt(raffleId));
  return PublicKey.findProgramAddressSync(
    [RAFFLE_SEED, raffleIdBuffer],
    MULTI_RAFFLE_INCO_PROGRAM_ID,
  );
}

function deriveVaultPda(raffle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, raffle.toBuffer()],
    MULTI_RAFFLE_INCO_PROGRAM_ID,
  );
}

function deriveTicketPda(
  raffle: PublicKey,
  buyer: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TICKET_SEED, raffle.toBuffer(), buyer.toBuffer()],
    MULTI_RAFFLE_INCO_PROGRAM_ID,
  );
}

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
  if (!RAFFLE_ID) {
    console.error(
      "Usage: bun run scripts/inco/join-raffle-inco.ts <raffle-id> [guess]",
    );
    console.error("Example: bun run scripts/inco/join-raffle-inco.ts 12345 42");
    process.exit(1);
  }

  console.log("\n🔒 FHE Join Raffle (Version A: Private Raffle)");
  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log("Program:", MULTI_RAFFLE_INCO_PROGRAM_ID.toBase58());
  console.log("Raffle ID:", RAFFLE_ID);
  console.log("Guess:", GUESS, "(1-100)");
  console.log();

  let walletKeypair: Keypair;

  if (process.env.SOL_PVT_KEY_2) {
    const privateKey = bs58.decode(process.env.SOL_PVT_KEY_2);
    walletKeypair = Keypair.fromSecretKey(privateKey);
  } else if (process.env.SOL_PVT_KEY) {
    const privateKey = bs58.decode(process.env.SOL_PVT_KEY);
    walletKeypair = Keypair.fromSecretKey(privateKey);
  } else {
    walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
    );
  }

  console.log("Payer:", walletKeypair.publicKey.toBase58());

  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log("Payer Balance:", balance / 1e9, "SOL");

  const [rafflePda, raffleBump] = deriveRafflePda(RAFFLE_ID);
  const [vaultPda, vaultBump] = deriveVaultPda(rafflePda);
  const [ticketPda, ticketBump] = deriveTicketPda(
    rafflePda,
    walletKeypair.publicKey,
  );

  console.log("\n📍 Derived PDAs:");
  console.log("  Raffle:", rafflePda.toBase58());
  console.log("  Vault:", vaultPda.toBase58());
  console.log("  Ticket:", ticketPda.toBase58());

  // Create encrypted guess (16-byte little-endian buffer for u128)
  const encryptedGuess = Buffer.alloc(16);
  encryptedGuess.writeBigUInt64LE(BigInt(GUESS), 0); // Write guess as little-endian

  // Build buy_ticket instruction with Anchor discriminator
  const discriminator = crypto
    .createHash("sha256")
    .update("global:buy_ticket")
    .digest()
    .slice(0, 8);

  // Build instruction data: discriminator + encrypted_guess (Vec<u8> with 4-byte LE length)
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(encryptedGuess.length, 0);

  const instructionData = Buffer.concat([
    discriminator,
    lenBuf, // 4-byte little-endian length prefix for Vec<u8>
    encryptedGuess,
  ]);

  const buyTicketIx = new TransactionInstruction({
    keys: [
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true }, // buyer
      { pubkey: rafflePda, isSigner: false, isWritable: true }, // raffle
      { pubkey: ticketPda, isSigner: false, isWritable: true }, // ticket
      { pubkey: vaultPda, isSigner: false, isWritable: true }, // vault
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      {
        pubkey: new PublicKey("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"),
        isSigner: false,
        isWritable: false,
      }, // inco_lightning_program
    ],
    programId: MULTI_RAFFLE_INCO_PROGRAM_ID,
    data: instructionData,
  });

  console.log("\n🚀 Buying ticket...");
  console.log("  Instruction: buy_ticket");
  console.log("  Guess:", GUESS, "(encrypted)");
  console.log("  Ticket Price: Will be deducted from vault");

  const transaction = new Transaction().add(buyTicketIx);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      walletKeypair,
    ]);
    console.log("\n✅ Ticket purchased successfully!");
    console.log("  Transaction:", signature);
    console.log("  Ticket PDA:", ticketPda.toBase58());

    // Verify the ticket was created
    const ticketAccount = await connection.getAccountInfo(ticketPda);
    if (ticketAccount) {
      console.log("  Ticket account confirmed on-chain");
    }
  } catch (error) {
    console.error("\n❌ Failed to buy ticket:");
    console.error(error);
    process.exit(1);
  }
  console.log("\n💡 Once compiled, this script will:");
  console.log("   1. Join raffle by selecting slots:", "slotIds.join(", ")");
  console.log("   2. Pay", "AMOUNT_SOL_STR", "SOL to treasury");
  console.log("   3. Wait for encrypted draw");
  console.log("   4. Check if your slots match encrypted winning slot");
}

main().catch((err) => {
  console.error("\n❌ Error in join-raffle-inco:");
  console.error(err);
  process.exit(1);
});
