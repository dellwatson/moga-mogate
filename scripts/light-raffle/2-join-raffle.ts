/**
 * Join Raffle Script
 *
 * Joins an existing raffle with specified slots
 *
 * Usage:
 *   SOL_PVT_KEY=<base58-private-key> bun run scripts/light-raffle/2-join-raffle.ts <slot1,slot2,slot3> <amount-sol>
 *
 * Example:
 *   SOL_PVT_KEY=abc123... bun run scripts/light-raffle/2-join-raffle.ts "1,2,3" 0.01
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import fs from "fs";
import path from "path";

// Program ID for the deployed multi_raffle-light program
const PROGRAM_ID = new PublicKey(
  "6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44",
);

// Network config
const NETWORK = "devnet";
const RPC_URL = "https://api.devnet.solana.com";

// Seeds
const CONFIG_SEED = Buffer.from("config");
const RAFFLE_SEED = Buffer.from("raffle");
const USER_SEED = Buffer.from("user");

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

function deriveUserRafflePda(
  rafflePubkey: PublicKey,
  userPubkey: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_SEED, rafflePubkey.toBuffer(), userPubkey.toBuffer()],
    PROGRAM_ID,
  );
}

async function main() {
  console.log("🎫 Join Raffle");
  console.log("===============\n");

  // Parse arguments
  const slotsArg = process.argv[2] || "1,2";
  const amountArg = process.argv[3] || "0.01";

  const slotIds = slotsArg.split(",").map((s) => parseInt(s.trim()));
  const amountSol = parseFloat(amountArg);
  const amount = new anchor.BN(amountSol * LAMPORTS_PER_SOL);

  console.log(`📋 Join Config:`);
  console.log(`   Slots: ${slotIds.join(", ")}`);
  console.log(`   Amount: ${amountSol} SOL\n`);

  // Load raffle info
  const raffleInfoPath = path.join(__dirname, "raffle-info.json");
  if (!fs.existsSync(raffleInfoPath)) {
    console.error("❌ raffle-info.json not found. Run 1-host-raffle.ts first!");
    process.exit(1);
  }
  const raffleInfo = JSON.parse(fs.readFileSync(raffleInfoPath, "utf-8"));
  const raffleId = raffleInfo.raffleId;
  const rafflePda = new PublicKey(raffleInfo.rafflePda);
  const slotsPda = new PublicKey(raffleInfo.slotsPda);
  const treasuryPda = new PublicKey(raffleInfo.treasuryPda);

  console.log(`🎲 Raffle: ${raffleId}`);
  console.log(`   PDA: ${rafflePda.toBase58()}\n`);

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");

  // Load wallet from env or default
  let walletKeypair: Keypair;
  if (process.env.SOL_PVT_KEY) {
    console.log("🔑 Using SOL_PVT_KEY from environment");
    walletKeypair = Keypair.fromSecretKey(bs58.decode(process.env.SOL_PVT_KEY));
  } else if (process.env.SOL_PVT_KEY_2) {
    console.log("🔑 Using SOL_PVT_KEY_2 from environment");
    walletKeypair = Keypair.fromSecretKey(
      bs58.decode(process.env.SOL_PVT_KEY_2),
    );
  } else {
    console.log("🔑 Using default wallet");
    const defaultPath = path.join(
      process.env.HOME || "~",
      ".config/solana/id.json",
    );
    walletKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(defaultPath, "utf-8"))),
    );
  }

  console.log(`👛 Wallet: ${walletKeypair.publicKey.toBase58()}`);

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

  // Derive PDAs
  const [configPda] = deriveConfigPda();
  const [userRafflePda] = deriveUserRafflePda(
    rafflePda,
    walletKeypair.publicKey,
  );

  console.log(`🔑 User Raffle PDA: ${userRafflePda.toBase58()}\n`);

  try {
    // Join raffle
    console.log("🚀 Joining raffle...");
    const tx = await program.methods
      .unsafeJoinRaffle(slotIds, amount)
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
    console.log("✅ Joined raffle!\n");

    // Fetch updated data
    const raffleData = await program.account.raffle.fetch(rafflePda);
    const userRaffleData =
      await program.account.userRaffle.fetch(userRafflePda);

    console.log(`🎉 Success!`);
    console.log(`   Your Slots: ${userRaffleData.slots.join(", ")}`);
    console.log(
      `   Paid: ${userRaffleData.paid.toNumber() / LAMPORTS_PER_SOL} SOL`,
    );
    console.log(
      `   Raffle Sold Slots: ${raffleData.soldSlots}/${raffleData.totalSlots}`,
    );
    console.log(
      `\n🔗 Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`,
    );
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
