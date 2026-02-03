/**
 * Host Raffle Script for verA-light
 *
 * Creates a new raffle with explicit slot selection + LIGHT compressed storage + FHE
 *
 * Usage:
 *   bun run scripts/inco/verA-light/host.ts
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

// Program ID for multi_raffle-inco-A-light
const PROGRAM_ID = new PublicKey(
  "86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o",
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

function deriveSlotsPda(raffle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SLOTS_SEED, raffle.toBuffer()],
    PROGRAM_ID,
  );
}

function deriveTreasuryPda(raffle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, raffle.toBuffer()],
    PROGRAM_ID,
  );
}

// Main function
async function main() {
  console.log(
    "🎯 Hosting raffle with verA-light (Explicit Slots + LIGHT + FHE)",
  );

  // Setup connection and wallet
  const connection = new Connection(RPC_URL, "confirmed");
  const walletKeypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))),
  );
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Load program IDL (you may need to generate this first)
  const idlPath = path.join(__dirname, "multi_raffle_inco_a_light.json");

  if (!fs.existsSync(idlPath)) {
    console.error("❌ IDL not found. Please run: anchor build");
    process.exit(1);
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // Raffle parameters
  const raffleId = `verA-light-${Date.now()}`;
  const totalSlots = 1000000; // 1M slots for LIGHT scalability
  const maxSlotsPerAddress = 100;
  const metadataUri = "https://example.com/metadata/verA-light";
  const collection = new PublicKey("11111111111111111111111111111112"); // Example
  const prizeType = 0; // None
  const prizeAmount = 0; // Offchain pricing
  const autoDraw = true;
  const autoClaim = false;
  const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours

  try {
    console.log(`📝 Creating raffle: ${raffleId}`);
    console.log(`📊 Total slots: ${totalSlots.toLocaleString()}`);
    console.log(`🔒 Max per address: ${maxSlotsPerAddress}`);

    // Derive PDAs
    const [configPda] = deriveConfigPda();
    const [rafflePda, raffleBump] = deriveRafflePda(raffleId);
    const [slotsPda, slotsBump] = deriveSlotsPda(rafflePda);
    const [treasuryPda, treasuryBump] = deriveTreasuryPda(rafflePda);

    console.log(`🎫 Raffle PDA: ${rafflePda.toString()}`);
    console.log(`💎 Slots PDA: ${slotsPda.toString()}`);
    console.log(`🏦 Treasury PDA: ${treasuryPda.toString()}`);

    // Call unsafe_host_raffle
    const tx = await program.methods
      .unsafeHostRaffle(
        raffleId,
        totalSlots,
        maxSlotsPerAddress,
        metadataUri,
        collection,
        false, // premintContract
        false, // premint
        prizeType,
        prizeAmount,
        autoDraw,
        autoClaim,
        expiresAt,
      )
      .accounts({
        authority: wallet.publicKey,
        raffle: rafflePda,
        slots: slotsPda,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Raffle hosted successfully!`);
    console.log(
      `🔗 Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`,
    );
    console.log(
      `📋 Raffle: https://explorer.solana.com/account/${rafflePda.toString()}?cluster=devnet`,
    );

    // Save raffle info
    const raffleInfo = {
      raffleId,
      configPda: configPda.toString(),
      rafflePda: rafflePda.toString(),
      slotsPda: slotsPda.toString(),
      treasuryPda: treasuryPda.toString(),
      totalSlots,
      maxSlotsPerAddress,
      expiresAt,
      tx,
    };

    fs.writeFileSync(
      path.join(__dirname, "raffle-info.json"),
      JSON.stringify(raffleInfo, null, 2),
    );

    console.log(`💾 Raffle info saved to raffle-info.json`);
  } catch (error) {
    console.error("❌ Error hosting raffle:", error);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
