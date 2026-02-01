/**
 * Test Light Raffle - Host raffle using Anchor client
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

// Program ID
const PROGRAM_ID = new PublicKey(
  "6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44",
);

// Network config
const RPC_URL = "https://api.devnet.solana.com";

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
  console.log("🎲 Test Light Raffle - Host (Anchor)");
  console.log("=====================================\n");

  // Parse arguments
  const slotCount = parseInt(process.argv[2]) || 10;
  const raffleName = process.argv[3] || `light-test-${slotCount}`;

  console.log(`📋 Raffle Config:`);
  console.log(`   Name: ${raffleName}`);
  console.log(`   Slots: ${slotCount}`);
  console.log(`   Max per Address: 5\n`);

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");
  console.log(`📡 Connected to devnet`);

  // Load wallet
  const walletPath = path.join(
    process.env.HOME || "~",
    ".config/solana/id.json",
  );
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))),
  );
  console.log(`👛 Host: ${walletKeypair.publicKey.toBase58()}`);

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  try {
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

    // Derive PDAs
    const [configPda] = deriveConfigPda();
    const [rafflePda] = deriveRafflePda(raffleName);
    const [slotsPda] = deriveSlotsPda(rafflePda);
    const [treasuryPda] = deriveTreasuryPda(rafflePda);

    console.log(`🔑 PDAs:`);
    console.log(`   Config: ${configPda.toBase58()}`);
    console.log(`   Raffle: ${rafflePda.toBase58()}`);
    console.log(`   Slots: ${slotsPda.toBase58()}`);
    console.log(`   Treasury: ${treasuryPda.toBase58()}\n`);

    // Check if raffle already exists
    try {
      await program.account.raffle.fetch(rafflePda);
      console.log("⚠️  Raffle already exists, skipping creation");
      return;
    } catch {
      // Raffle doesn't exist, continue
    }

    // Raffle parameters
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const metadataUri = "https://arweave.net/test-metadata.json";
    const collection = PublicKey.default; // Default pubkey for testing

    console.log("🚀 Hosting raffle...");

    // Call unsafe_host_raffle
    const tx = await program.methods
      .unsafeHostRaffle(
        raffleName,
        new anchor.BN(slotCount),
        new anchor.BN(5), // max slots per address
        metadataUri,
        collection,
        false, // premint_contract
        false, // premint
        1, // prize_type (SPL token)
        new anchor.BN(1000000), // prize_amount (0.001 SOL in lamports)
        true, // auto_draw
        false, // auto_claim
        new anchor.BN(expiresAt.getTime() / 1000), // expires_at (Unix timestamp)
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

    console.log(`✅ Success! Transaction: ${tx}`);

    // Save raffle info for join test
    const raffleInfo = {
      raffleId: raffleName,
      rafflePda: rafflePda.toBase58(),
      slotsPda: slotsPda.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      totalSlots: slotCount,
      signature: tx,
    };

    fs.writeFileSync(
      path.join(__dirname, "raffle-info.json"),
      JSON.stringify(raffleInfo, null, 2),
    );

    console.log(`💾 Saved raffle info to raffle-info.json`);

    // Verify raffle was created
    const raffleAccount = await program.account.raffle.fetch(rafflePda);
    console.log(`✅ Raffle created successfully!`);
    console.log(`   ID: ${raffleAccount.raffleId}`);
    console.log(`   Total Slots: ${raffleAccount.totalSlots}`);
    console.log(`   Status: ${raffleAccount.status}`);
  } catch (error) {
    console.error("❌ Error:", error);
    console.log("\n📋 Error details:");
    if (error instanceof Error) {
      console.log("   Type:", error.constructor.name);
      console.log("   Message:", error.message);
      if ("logs" in error) {
        console.log("   Logs:", (error as any).logs);
      }
    }
  }
}

main().catch(console.error);
