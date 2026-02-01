/**
 * Host Raffle Script
 *
 * Creates a new raffle on the deployed multi_raffle program
 *
 * Usage:
 *   bun run scripts/light-raffle/1-host-raffle.ts
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

// Program ID for the deployed multi_raffle-light program
const PROGRAM_ID = new PublicKey(
  "6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44",
);

// Network config
const NETWORK = "devnet";
const RPC_URL = "https://api.devnet.solana.com";
const WALLET_PATH = path.join(
  process.env.HOME || "~",
  ".config/solana/id.json",
);

// Seeds
const CONFIG_SEED = Buffer.from("config");
const RAFFLE_SEED = Buffer.from("raffle");
const SLOTS_SEED = Buffer.from("slots");
const TREASURY_SEED = Buffer.from("treasury");

// Derive PDAs
function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
}

function deriveRafflePda(raffleId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [RAFFLE_SEED, Buffer.from(raffleId)],
    PROGRAM_ID,
  );
}

function deriveSlotsPda(rafflePubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SLOTS_SEED, rafflePubkey.toBuffer()],
    PROGRAM_ID,
  );
}

function deriveTreasuryPda(rafflePubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, rafflePubkey.toBuffer()],
    PROGRAM_ID,
  );
}

async function main() {
  console.log("🎲 Host Raffle");
  console.log("===============\n");

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");
  console.log(`📡 Connected to ${NETWORK}`);

  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
  );
  console.log(`👛 Host Wallet: ${walletKeypair.publicKey.toBase58()}`);

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  // Setup Anchor
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(walletKeypair),
    { commitment: "confirmed" },
  );

  // Load IDL
  const idlPath = path.join(__dirname, "multi_raffle_light.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // Raffle parameters
  const raffleId = `light-test-${Date.now()}`;
  const totalSlots = 10;
  const maxSlotsPerAddress = 5;
  const metadataUri = "https://arweave.net/raffle-metadata.json";
  const collection = PublicKey.default;

  console.log(`📋 Raffle Config:`);
  console.log(`   ID: ${raffleId}`);
  console.log(`   Total Slots: ${totalSlots}`);
  console.log(`   Max per Address: ${maxSlotsPerAddress}\n`);

  // Derive PDAs
  const [configPda] = deriveConfigPda();
  const [rafflePda] = deriveRafflePda(raffleId);
  const [slotsPda] = deriveSlotsPda(rafflePda);
  const [treasuryPda] = deriveTreasuryPda(rafflePda);

  console.log(`🔑 PDAs:`);
  console.log(`   Config: ${configPda.toBase58()}`);
  console.log(`   Raffle: ${rafflePda.toBase58()}`);
  console.log(`   Slots: ${slotsPda.toBase58()}`);
  console.log(`   Treasury: ${treasuryPda.toBase58()}\n`);

  try {
    // Check if config exists
    try {
      await program.account.config.fetch(configPda);
      console.log("✅ Config exists\n");
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

    // Host raffle
    console.log("🚀 Hosting raffle...");
    const tx = await program.methods
      .unsafeHostRaffle(
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
      )
      .accounts({
        payer: walletKeypair.publicKey,
        config: configPda,
        raffle: rafflePda,
        slots: slotsPda,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`   Signature: ${tx}`);
    console.log("✅ Raffle hosted!\n");

    // Fetch raffle data
    const raffleData = await program.account.raffle.fetch(rafflePda);

    console.log(`🎉 Success!`);
    console.log(`   Raffle ID: ${raffleData.raffleId}`);
    console.log(`   Total Slots: ${raffleData.totalSlots}`);
    console.log(`   Sold Slots: ${raffleData.soldSlots}`);
    console.log(`   Status: ${raffleData.status}`);
    console.log(
      `\n🔗 Explorer: https://explorer.solana.com/address/${rafflePda.toBase58()}?cluster=devnet`,
    );

    // Save raffle info for join script
    const raffleInfo = {
      raffleId,
      rafflePda: rafflePda.toBase58(),
      slotsPda: slotsPda.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      totalSlots,
      timestamp: Date.now(),
    };
    fs.writeFileSync(
      path.join(__dirname, "raffle-info.json"),
      JSON.stringify(raffleInfo, null, 2),
    );
    console.log(`\n💾 Raffle info saved to raffle-info.json`);
  } catch (error: any) {
    console.error("\n❌ Error:", error.message || error);
    if (error.logs) {
      console.error("\n📋 Program Logs:");
      error.logs.forEach((log: string) => console.error(`   ${log}`));
    }
    process.exit(1);
  }
}

main().catch(console.error);
