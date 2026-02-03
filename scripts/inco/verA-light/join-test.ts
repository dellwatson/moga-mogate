/**
 * Join Raffle Test for verA-light
 *
 * Raw transaction test to join raffle with explicit slot selection
 *
 * Usage:
 *   bun run scripts/inco/verA-light/join-test.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";

// Program ID for multi_raffle-inco-A-light
const PROGRAM_ID = new PublicKey(
  "86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o",
);

// Network config
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
    "🎯 Join raffle test for verA-light (Explicit Slots + LIGHT + FHE)",
  );

  // Load previous test result
  const testResultPath = path.join(__dirname, "test-result.json");
  if (!fs.existsSync(testResultPath)) {
    console.error(
      "❌ No raffle test result found. Please run simple-test.ts first.",
    );
    process.exit(1);
  }

  const raffleTest = JSON.parse(fs.readFileSync(testResultPath, "utf8"));
  console.log(`📋 Using raffle: ${raffleTest.raffleId}`);

  // Setup connection and wallet
  const connection = new Connection(RPC_URL, "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))),
  );
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  console.log(`👤 Wallet: ${walletKeypair.publicKey.toString()}`);
  console.log(`📋 Program: ${PROGRAM_ID.toString()}`);

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

  // Load LIGHT proof + address tree info
  const proofPath = path.join(__dirname, "light-proof.json");
  if (!fs.existsSync(proofPath)) {
    console.error(
      "❌ LIGHT proof not found. Please generate light-proof.json with generate-ligh-proof.ts.",
    );
    process.exit(1);
  }

  const proofData = JSON.parse(fs.readFileSync(proofPath, "utf8"));

  const proof = proofData.proof as any;
  const addressTreeInfo = proofData.addressTreeInfo as any;
  const outputStateTreeIndex = proofData.outputStateTreeIndex as number;

  const lightStateTree = new PublicKey(proofData.lightStateTree);
  const lightSystemProgram = new PublicKey(proofData.lightSystemProgram);

  const remainingAccountsMeta =
    (proofData.remainingAccounts as {
      pubkey: string;
      isSigner: boolean;
      isWritable: boolean;
    }[]) || [];

  const remainingAccounts = remainingAccountsMeta.map((meta) => ({
    pubkey: new PublicKey(meta.pubkey),
    isSigner: meta.isSigner,
    isWritable: meta.isWritable,
  }));

  // Join parameters
  const amount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
  const slotIds = [1, 2, 3, 4, 5]; // Explicit slot selection

  try {
    console.log(`🎟️  Joining raffle with explicit slots`);
    console.log(`💰 Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
    console.log(`🎫 Selected slots: ${slotIds.join(", ")}`);

    // Derive PDAs
    const [configPda] = deriveConfigPda();
    const rafflePda = new PublicKey(raffleTest.rafflePda);
    const slotsPda = new PublicKey(raffleTest.slotsPda);
    const treasuryPda = new PublicKey(raffleTest.treasuryPda);
    const [userRafflePda, userRaffleBump] = deriveUserRafflePda(
      rafflePda,
      walletKeypair.publicKey,
    );

    console.log(`👤 User Raffle PDA: ${userRafflePda.toString()}`);

    console.log(
      `💰 Balance: ${await connection.getBalance(walletKeypair.publicKey)} lamports`,
    );
    console.log(`📤 Sending join transaction via Anchor...`);

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_000_000,
    });

    const signature = await program.methods
      .unsafeJoinRaffle(
        slotIds,
        amount,
        proof,
        addressTreeInfo,
        outputStateTreeIndex,
      )
      .accounts({
        payer: walletKeypair.publicKey,
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
      .preInstructions([computeBudgetIx])
      .remainingAccounts(remainingAccounts)
      .rpc();

    console.log(`✅ Successfully joined raffle!`);
    console.log(
      `🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    );
    console.log(
      `👤 User Raffle: https://explorer.solana.com/account/${userRafflePda.toString()}?cluster=devnet`,
    );

    // Save join result
    const joinResult = {
      success: true,
      raffleId: raffleTest.raffleId,
      userRafflePda: userRafflePda.toString(),
      slotIds,
      amount,
      signature,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "join-result.json"),
      JSON.stringify(joinResult, null, 2),
    );

    console.log(`💾 Join result saved to join-result.json`);
  } catch (error) {
    console.error("❌ Join test failed:", error);

    // Save error result
    const joinResult = {
      success: false,
      error: error.message,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "join-result.json"),
      JSON.stringify(joinResult, null, 2),
    );

    process.exit(1);
  }
}

// Run main
main().catch(console.error);
