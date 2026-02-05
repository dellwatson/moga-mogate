/**
 * Simple Test for verA-light
 *
 * Creates a small raffle using the commit-reveal + LIGHT flow
 *
 * Usage:
 *   bun run scripts/inco/verA-light/simple-test.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  createRpc,
  featureFlags,
  VERSION,
  selectStateTreeInfo,
  getDefaultAddressTreeInfo,
} from "@lightprotocol/stateless.js";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey(
  "86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o",
);

const RPC_URL = "https://api.devnet.solana.com";
const WALLET_PATH = path.join(
  process.env.HOME || "~",
  ".config/solana/id.json",
);

const CONFIG_SEED = Buffer.from("config");
const RAFFLE_SEED = Buffer.from("raffle");
const SLOTS_SEED = Buffer.from("slots");
const TREASURY_SEED = Buffer.from("treasury");

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

async function main() {
  console.log("🎯 Simple test for verA-light (commit-reveal + LIGHT)");

  const connection = new Connection(RPC_URL, "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))),
  );
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

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

  (featureFlags as any).version = (VERSION as any).V2 ?? VERSION.V2;
  const rpc = createRpc(RPC_URL, RPC_URL, RPC_URL);
  const stateTreeInfos = await rpc.getStateTreeInfos();
  const stateTreeInfo = selectStateTreeInfo(stateTreeInfos);
  const addressTreeInfo = getDefaultAddressTreeInfo();

  const raffleId = `test-${Date.now()}`;
  const totalSlots = 1000;
  const maxSlotsPerAddress = 10;
  const metadataUri = "https://example.com/test";
  const collection = new PublicKey("11111111111111111111111111111112");
  const prizeType = 0;
  const prizeAmount = 0;
  const autoDraw = false;
  const autoClaim = false;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  const [configPda] = deriveConfigPda();
  const [rafflePda] = deriveRafflePda(raffleId);
  const [slotsPda] = deriveSlotsPda(rafflePda);
  const [treasuryPda] = deriveTreasuryPda(rafflePda);

  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    console.log("⚙️  Initializing config...");
    await program.methods
      .initializeConfig(100)
      .accounts({
        admin: wallet.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  console.log(`📝 Creating raffle: ${raffleId}`);
  const tx = await program.methods
    .unsafeHostRaffle(
      raffleId,
      totalSlots,
      maxSlotsPerAddress,
      metadataUri,
      collection,
      false,
      false,
      prizeType,
      prizeAmount,
      autoDraw,
      autoClaim,
      expiresAt,
    )
    .accounts({
      payer: wallet.publicKey,
      config: configPda,
      raffle: rafflePda,
      slots: slotsPda,
      addressTree: addressTreeInfo.tree,
      addressQueue: addressTreeInfo.queue,
      stateTree: stateTreeInfo.tree,
      stateQueue: stateTreeInfo.queue,
      treasury: treasuryPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const testResult = {
    raffleId,
    configPda: configPda.toString(),
    rafflePda: rafflePda.toString(),
    slotsPda: slotsPda.toString(),
    treasuryPda: treasuryPda.toString(),
    addressTree: addressTreeInfo.tree.toBase58(),
    addressQueue: addressTreeInfo.queue.toBase58(),
    stateTree: stateTreeInfo.tree.toBase58(),
    stateQueue: stateTreeInfo.queue.toBase58(),
    tx,
    timestamp: Date.now(),
  };

  fs.writeFileSync(
    path.join(__dirname, "test-result.json"),
    JSON.stringify(testResult, null, 2),
  );

  console.log("✅ Test raffle created");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
