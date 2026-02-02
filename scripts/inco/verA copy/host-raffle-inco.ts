/**
 * FHE Host Raffle Script (multi_raffle-inco - Version A: Slot-Based)
 *
 * Creates a new raffle with FHE-encrypted draw functionality.
 * Slot ownership is public, but the winning slot is encrypted.
 *
 * Usage:
 *   bun run scripts/inco/host-raffle-inco.ts <raffle-id> <collection-mint> <metadata-uri>
 *     [total-slots=10] [max-slots-per-address=5] [expires-in-seconds=3600]
 *
 * Env:
 *   SOLANA_NETWORK   - devnet | mainnet (default devnet)
 *   SOLANA_RPC_URL   - custom RPC (optional)
 *   WALLET_PATH      - keypair json (default ~/.config/solana/id.json)
 *   SOL_PVT_KEY      - base58 encoded private key (optional, overrides WALLET_PATH)
 *   RAFFLE_PRIZE_TYPE   - u8 prize_type (default 1)
 *   RAFFLE_PRIZE_AMOUNT - u64 (as string, default "1")
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

// CLI args - simplified for deployed program
const RAFFLE_ID = parseInt(
  process.argv[2] || Math.floor(Math.random() * 1000000),
  10,
);
const TICKET_PRICE = parseFloat(process.argv[3] || "0.1") * 1e9; // Convert SOL to lamports

// PDA derivation helpers for deployed private_raffle program
const RAFFLE_SEED = Buffer.from("raffle");
const VAULT_SEED = Buffer.from("vault");

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

async function main() {
  console.log("\n🔒 FHE Host Raffle (Version A: Private Raffle)");
  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log("Program:", MULTI_RAFFLE_INCO_PROGRAM_ID.toBase58());
  console.log("Raffle ID:", RAFFLE_ID);
  console.log("Ticket Price:", TICKET_PRICE / 1e9, "SOL");
  console.log();

  // Load wallet
  let walletKeypair: Keypair;

  if (process.env.SOL_PVT_KEY) {
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

  console.log("\n📍 Derived PDAs:");
  console.log("  Raffle:", rafflePda.toBase58());
  console.log("  Vault:", vaultPda.toBase58());

  // Build create_raffle instruction with Anchor discriminator
  const discriminator = crypto
    .createHash("sha256")
    .update("global:create_raffle")
    .digest()
    .slice(0, 8);
  const instructionData = Buffer.alloc(24); // 8 bytes discriminator + 8 bytes raffle_id + 8 bytes ticket_price
  discriminator.copy(instructionData, 0);
  instructionData.writeBigUInt64LE(BigInt(RAFFLE_ID), 8);
  instructionData.writeBigUInt64LE(BigInt(TICKET_PRICE), 16);

  const createRaffleIx = new TransactionInstruction({
    keys: [
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true }, // authority
      { pubkey: rafflePda, isSigner: false, isWritable: true }, // raffle
      { pubkey: vaultPda, isSigner: false, isWritable: true }, // vault
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: MULTI_RAFFLE_INCO_PROGRAM_ID,
    data: instructionData,
  });

  console.log("\n🚀 Creating raffle...");
  console.log("  Instruction: create_raffle");
  console.log("  Raffle ID:", RAFFLE_ID);
  console.log("  Ticket Price:", TICKET_PRICE / 1e9, "SOL");

  const transaction = new Transaction().add(createRaffleIx);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      walletKeypair,
    ]);
    console.log("\n✅ Raffle created successfully!");
    console.log("  Transaction:", signature);
    console.log("  Raffle PDA:", rafflePda.toBase58());
    console.log("  Vault PDA:", vaultPda.toBase58());

    // Verify the raffle was created
    const raffleAccount = await connection.getAccountInfo(rafflePda);
    if (raffleAccount) {
      console.log("  Raffle account confirmed on-chain");
    }
  } catch (error) {
    console.error("\n❌ Failed to create raffle:");
    console.error(error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Error in host-raffle-inco:");
  console.error(err);
  process.exit(1);
});
