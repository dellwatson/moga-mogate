/**
 * Draw raffle (winner slot)
 *
 * Usage:
 *   bun run scripts/inco/verA-light/draw.ts
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey(
  "86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o",
);
const INCO_LIGHTNING_ID = new PublicKey(
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj",
);

const RPC_URL = "https://api.devnet.solana.com";
const WALLET_PATH = path.join(
  process.env.HOME || "~",
  ".config/solana/id.json",
);

async function main() {
  const raffleInfoPath = path.join(__dirname, "raffle-info.json");
  if (!fs.existsSync(raffleInfoPath)) {
    console.error("❌ raffle-info.json not found. Run host.ts first.");
    process.exit(1);
  }

  const raffleInfo = JSON.parse(fs.readFileSync(raffleInfoPath, "utf8"));

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

  const rafflePda = new PublicKey(raffleInfo.rafflePda);
  const slotsPda = new PublicKey(raffleInfo.slotsPda);

  const tx = await program.methods
    .drawRaffle()
    .accounts({
      authority: wallet.publicKey,
      raffle: rafflePda,
      slots: slotsPda,
      incoLightningProgram: INCO_LIGHTNING_ID,
    })
    .rpc();

  console.log(`✅ Winner slot picked`);
  console.log(
    `🔗 Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
