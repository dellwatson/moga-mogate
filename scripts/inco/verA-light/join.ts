/**
 * Join Raffle Script for verA-light
 *
 * Joins a raffle with explicit slot selection + LIGHT compressed storage + FHE
 *
 * Usage:
 *   bun run scripts/inco/verA-light/join.ts
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
const USER_SEED = Buffer.from("user");
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

function deriveUserRafflePda(
  raffle: PublicKey,
  user: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_SEED, raffle.toBuffer(), user.toBuffer()],
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
    "🎯 Joining raffle with verA-light (Explicit Slots + LIGHT + FHE)",
  );

  // Load raffle info
  const raffleInfoPath = path.join(__dirname, "raffle-info.json");
  if (!fs.existsSync(raffleInfoPath)) {
    console.error("❌ Raffle info not found. Please run host.ts first.");
    process.exit(1);
  }

  const raffleInfo = JSON.parse(fs.readFileSync(raffleInfoPath, "utf8"));
  console.log(`📋 Raffle ID: ${raffleInfo.raffleId}`);

  // Load LIGHT proof + address tree info
  const proofPath = path.join(__dirname, "light-proof.json");
  if (!fs.existsSync(proofPath)) {
    console.error(
      "❌ LIGHT proof not found. Please generate light-proof.json with the zk-compression CLI.",
    );
    process.exit(1);
  }

  const proofData = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  const proof = Buffer.from(proofData.proof, "base64");
  const addressTreeInfo = Buffer.from(proofData.addressTreeInfo, "base64");
  const outputStateTreeIndex = proofData.outputStateTreeIndex as number;
  const lightStateTree = new PublicKey(proofData.lightStateTree);
  const lightSystemProgram = new PublicKey(proofData.lightSystemProgram);

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
    "../../../target/idl/multi_raffle_inco_a_light.json",
  );

  if (!fs.existsSync(idlPath)) {
    console.error("❌ IDL not found. Please run: anchor build");
    process.exit(1);
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // Join parameters
  const amount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
  const slotIds = [1, 2, 3, 4, 5]; // Explicit slot selection

  try {
    console.log(`💰 Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
    console.log(`🎫 Selected slots: ${slotIds.join(", ")}`);

    // Derive PDAs
    const configPda = new PublicKey(raffleInfo.configPda);
    const rafflePda = new PublicKey(raffleInfo.rafflePda);
    const slotsPda = new PublicKey(raffleInfo.slotsPda);
    const treasuryPda = new PublicKey(raffleInfo.treasuryPda);
    const [userRafflePda, userRaffleBump] = deriveUserRafflePda(
      rafflePda,
      wallet.publicKey,
    );

    console.log(`👤 User Raffle PDA: ${userRafflePda.toString()}`);

    // Call unsafe_join_raffle
    const tx = await program.methods
      .unsafeJoinRaffle(
        slotIds,
        amount,
        proof,
        addressTreeInfo,
        outputStateTreeIndex,
      )
      .accounts({
        payer: wallet.publicKey,
        config: configPda,
        raffle: rafflePda,
        slots: slotsPda,
        userRaffle: userRafflePda,
        lightStateTree,
        lightSystemProgram,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
        incoLightningProgram: new PublicKey(
          "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj",
        ),
      })
      .rpc();

    console.log(`✅ Joined raffle successfully!`);
    console.log(
      `🔗 Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`,
    );
    console.log(
      `👤 User Raffle: https://explorer.solana.com/account/${userRafflePda.toString()}?cluster=devnet`,
    );

    // Save join info
    const joinInfo = {
      userRafflePda: userRafflePda.toString(),
      slotIds,
      amount,
      tx,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "join-info.json"),
      JSON.stringify(joinInfo, null, 2),
    );

    console.log(`💾 Join info saved to join-info.json`);
  } catch (error) {
    console.error("❌ Error joining raffle:", error);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
