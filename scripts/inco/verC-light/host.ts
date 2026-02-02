/**
 * Host Raffle Script for verC-light
 *
 * Creates a new raffle with auto-assigned numbers + LIGHT compressed storage + FHE
 *
 * Usage:
 *   bun run scripts/inco/verC-light/host.ts
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

// Program ID for multi_raffle-inco-C-light
const PROGRAM_ID = new PublicKey(
  "FETxRpn16JkFzBm8Fwoi1RXapP6uGvScM3jJ5sdjEKHp",
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
    "🎯 Hosting raffle with verC-light (Auto-Assigned Numbers + LIGHT + FHE)",
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

  // Load program IDL
  const idlPath = path.join(
    __dirname,
    "../../programs/multi_raffle-inco-C-light/target/idl/multi_raffle_inco_c_light.json",
  );

  if (!fs.existsSync(idlPath)) {
    console.error("❌ IDL not found. Please run: anchor build");
    process.exit(1);
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // Raffle parameters (auto-assigned numbers)
  const raffleId = `verC-light-${Date.now()}`;
  const maxNumber = 1000000; // Range 1-1M for auto-assignment
  const metadataUri = "https://example.com/metadata/verC-light";
  const collection = new PublicKey("11111111111111111111111111111112"); // Example
  const prizeType = 0; // None
  const prizeAmount = 0; // Offchain pricing
  const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours

  try {
    console.log(`📝 Creating raffle: ${raffleId}`);
    console.log(`🔢 Number range: 1-${maxNumber.toLocaleString()}`);

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
        maxNumber,
        metadataUri,
        collection,
        prizeType,
        prizeAmount,
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
      rafflePda: rafflePda.toString(),
      slotsPda: slotsPda.toString(),
      treasuryPda: treasuryPda.toString(),
      maxNumber,
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
