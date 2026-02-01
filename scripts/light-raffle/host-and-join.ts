/**
 * Host and Join Raffle Script
 *
 * Creates a new raffle and immediately joins it with specified slots
 *
 * Usage:
 *   bun run scripts/light-raffle/host-and-join.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";

// Program ID (newly deployed)
const MULTI_RAFFLE_PROGRAM_ID = new PublicKey(
  "5Nb1Mtm2VfjxqfkA9rKZVt294QSx1vUVCYT7Hi1DrZeM",
);

// Network config
const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME || "~", ".config/solana/id.json");

// Seeds
const CONFIG_SEED = Buffer.from("config");
const RAFFLE_SEED = Buffer.from("raffle");
const SLOTS_SEED = Buffer.from("slots");
const USER_SEED = Buffer.from("user");
const TREASURY_SEED = Buffer.from("treasury");

// Derive PDAs
function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    MULTI_RAFFLE_PROGRAM_ID,
  );
}

function deriveRafflePda(raffleId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [RAFFLE_SEED, Buffer.from(raffleId)],
    MULTI_RAFFLE_PROGRAM_ID,
  );
}

function deriveSlotsPda(rafflePubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SLOTS_SEED, rafflePubkey.toBuffer()],
    MULTI_RAFFLE_PROGRAM_ID,
  );
}

function deriveUserRafflePda(
  rafflePubkey: PublicKey,
  userPubkey: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_SEED, rafflePubkey.toBuffer(), userPubkey.toBuffer()],
    MULTI_RAFFLE_PROGRAM_ID,
  );
}

function deriveTreasuryPda(rafflePubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, rafflePubkey.toBuffer()],
    MULTI_RAFFLE_PROGRAM_ID,
  );
}

async function main() {
  console.log("🎲 Multi-Raffle: Host and Join");
  console.log("================================\n");

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");
  console.log(`📡 Connected to ${NETWORK}`);
  console.log(`   RPC: ${RPC_URL}\n`);

  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
  );
  console.log(`👛 Wallet: ${walletKeypair.publicKey.toBase58()}`);

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  // Setup Anchor
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(walletKeypair),
    { commitment: "confirmed" },
  );
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = path.join(__dirname, "../../target/idl/multi_raffle.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new anchor.Program(idl, MULTI_RAFFLE_PROGRAM_ID, provider);

  // Raffle parameters
  const raffleId = `test-raffle-${Date.now()}`;
  const totalSlots = 100;
  const maxSlotsPerAddress = 10;
  const metadataUri = "https://example.com/raffle-metadata.json";
  const collection = PublicKey.default; // No collection for now
  const slotIds = [1, 2, 3]; // Join slots 1, 2, 3
  const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL

  console.log(`📋 Raffle Config:`);
  console.log(`   ID: ${raffleId}`);
  console.log(`   Total Slots: ${totalSlots}`);
  console.log(`   Max per Address: ${maxSlotsPerAddress}`);
  console.log(`   Joining Slots: ${slotIds.join(", ")}`);
  console.log(`   Amount: ${amount.toNumber() / LAMPORTS_PER_SOL} SOL\n`);

  // Derive PDAs
  const [configPda] = deriveConfigPda();
  const [rafflePda] = deriveRafflePda(raffleId);
  const [slotsPda] = deriveSlotsPda(rafflePda);
  const [userRafflePda] = deriveUserRafflePda(
    rafflePda,
    walletKeypair.publicKey,
  );
  const [treasuryPda] = deriveTreasuryPda(rafflePda);

  console.log(`🔑 PDAs:`);
  console.log(`   Config: ${configPda.toBase58()}`);
  console.log(`   Raffle: ${rafflePda.toBase58()}`);
  console.log(`   Slots: ${slotsPda.toBase58()}`);
  console.log(`   User Raffle: ${userRafflePda.toBase58()}`);
  console.log(`   Treasury: ${treasuryPda.toBase58()}\n`);

  try {
    // Check if config exists, if not initialize it
    try {
      await program.account.config.fetch(configPda);
      console.log("✅ Config already initialized\n");
    } catch (e) {
      console.log("🔧 Initializing config...");
      const tx = await program.methods
        .initializeConfig(500) // 5% refund fee
        .accounts({
          admin: walletKeypair.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`   Signature: ${tx}`);
      console.log("✅ Config initialized\n");
    }

    // Host and join raffle
    console.log("🚀 Hosting and joining raffle...");
    const tx = await program.methods
      .unsafeHostAndJoinRaffle(
        raffleId,
        totalSlots,
        maxSlotsPerAddress,
        metadataUri,
        collection,
        false, // premintContract
        false, // premint
        1, // prizeType (SPL)
        new anchor.BN(1), // prizeAmount
        false, // autoDraw
        false, // autoClaim
        new anchor.BN(0), // expiresAt (0 = no expiry)
        slotIds,
        amount,
        0, // bonusFreeSlots
      )
      .accounts({
        payer: walletKeypair.publicKey,
        config: configPda,
        raffle: rafflePda,
        slots: slotsPda,
        userRaffle: userRafflePda,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`   Signature: ${tx}`);
    console.log("✅ Raffle hosted and joined!\n");

    // Fetch raffle data
    console.log("📊 Fetching raffle data...");
    const raffleData = await program.account.raffle.fetch(rafflePda);
    const userRaffleData =
      await program.account.userRaffle.fetch(userRafflePda);

    console.log(`\n🎉 Success!`);
    console.log(`   Raffle ID: ${raffleData.raffleId}`);
    console.log(`   Total Slots: ${raffleData.totalSlots}`);
    console.log(`   Sold Slots: ${raffleData.soldSlots}`);
    console.log(`   Status: ${raffleData.status}`);
    console.log(`   Your Slots: ${userRaffleData.slots.join(", ")}`);
    console.log(
      `   Paid: ${userRaffleData.paid.toNumber() / LAMPORTS_PER_SOL} SOL`,
    );

    console.log(`\n🔗 View on Solana Explorer:`);
    console.log(
      `   https://explorer.solana.com/address/${rafflePda.toBase58()}?cluster=${NETWORK}`,
    );
  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error.logs) {
      console.error("\n📋 Program Logs:");
      error.logs.forEach((log: string) => console.error(`   ${log}`));
    }
    process.exit(1);
  }
}

main().catch(console.error);
