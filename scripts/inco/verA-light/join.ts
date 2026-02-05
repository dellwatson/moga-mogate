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
  ComputeBudgetProgram,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { createHash, randomBytes } from "crypto";
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
const COMMITMENT_DOMAIN = "raffle-slot-commitment-v1";

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
      "❌ LIGHT proof not found. Please generate light-proof.json with generate-ligh-proof.ts.",
    );
    process.exit(1);
  }

  const proofData = JSON.parse(fs.readFileSync(proofPath, "utf8"));

  // Structured proof + tree info as produced by generate-ligh-proof.ts
  const proof = proofData.proof as any;
  const addressTreeInfo = proofData.addressTreeInfo as any;
  const outputStateTreeIndex = proofData.outputStateTreeIndex as number;
  const systemAccountsOffset = proofData.systemAccountsOffset as number;
  if (typeof systemAccountsOffset !== "number") {
    throw new Error(
      "systemAccountsOffset missing in light-proof.json. Re-run generate-ligh-proof.ts.",
    );
  }

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

  // Join parameters (can be overridden by join-config.json)
  const joinConfigPath = path.join(__dirname, "join-config.json");
  let amount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
  let slotIds = [1, 2, 3, 4, 5]; // Explicit slot selection
  if (fs.existsSync(joinConfigPath)) {
    const cfg = JSON.parse(fs.readFileSync(joinConfigPath, "utf8"));
    if (Array.isArray(cfg.slotIds)) {
      slotIds = cfg.slotIds;
    }
    if (typeof cfg.amountLamports === "number") {
      amount = cfg.amountLamports;
    } else if (typeof cfg.amountSol === "number") {
      amount = cfg.amountSol * LAMPORTS_PER_SOL;
    }
  }

  if (Array.isArray(proofData.slotIds)) {
    const mismatch = JSON.stringify(proofData.slotIds) !== JSON.stringify(slotIds);
    if (mismatch) {
      throw new Error(
        `slotIds mismatch between join.ts and light-proof.json. Update join-config.json and re-run generate-ligh-proof.ts.`,
      );
    }
  }

  const salts: string[] = [];
  const commitments: number[][] = [];
  for (const slotId of slotIds) {
    const salt = randomBytes(32);
    salts.push(salt.toString("hex"));

    const hash = createHash("sha256");
    hash.update(Buffer.from(COMMITMENT_DOMAIN));
    hash.update(new PublicKey(raffleInfo.rafflePda).toBuffer());
    const slotBuf = Buffer.alloc(4);
    slotBuf.writeUInt32LE(slotId, 0);
    hash.update(slotBuf);
    hash.update(wallet.publicKey.toBuffer());
    hash.update(salt);

    commitments.push(Array.from(hash.digest()));
  }

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

    // Optional: bump compute units for LIGHT + Inco CPI
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_000_000,
    });

    // Call unsafe_join_raffle
    const tx = await program.methods
      .unsafeJoinRaffle(
        slotIds,
        commitments,
        amount,
        proof,
        addressTreeInfo,
        outputStateTreeIndex,
        systemAccountsOffset,
      )
      .accounts({
        payer: wallet.publicKey,
        config: configPda,
        raffle: rafflePda,
        slots: slotsPda,
        userRaffle: userRafflePda,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([computeBudgetIx])
      .remainingAccounts(remainingAccounts)
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
      salts,
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
