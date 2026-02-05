/**
 * Reveal winner (commit-reveal finalize)
 *
 * Usage:
 *   bun run scripts/inco/verA-light/reveal.ts
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
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

async function main() {
  const raffleInfoPath = path.join(__dirname, "raffle-info.json");
  const revealProofPath = path.join(__dirname, "reveal-proof.json");
  const joinInfoPath = path.join(__dirname, "join-info.json");
  const revealConfigPath = path.join(__dirname, "reveal-config.json");

  if (!fs.existsSync(raffleInfoPath)) {
    console.error("❌ raffle-info.json not found. Run host.ts first.");
    process.exit(1);
  }
  if (!fs.existsSync(revealProofPath)) {
    console.error(
      "❌ reveal-proof.json not found. Run generate-reveal-proof.ts first.",
    );
    process.exit(1);
  }

  const raffleInfo = JSON.parse(fs.readFileSync(raffleInfoPath, "utf8"));
  const revealProof = JSON.parse(fs.readFileSync(revealProofPath, "utf8"));

  let slotId: number | null = revealProof.slotId ?? null;
  let saltHex: string | null = null;

  if (fs.existsSync(revealConfigPath)) {
    const cfg = JSON.parse(fs.readFileSync(revealConfigPath, "utf8"));
    if (typeof cfg.slotId === "number") {
      slotId = cfg.slotId;
    }
    if (typeof cfg.saltHex === "string") {
      saltHex = cfg.saltHex;
    }
  }

  if (!saltHex && fs.existsSync(joinInfoPath)) {
    const joinInfo = JSON.parse(fs.readFileSync(joinInfoPath, "utf8"));
    const slotIds: number[] = joinInfo.slotIds || [];
    const salts: string[] = joinInfo.salts || [];
    if (slotId == null && slotIds.length > 0) {
      slotId = slotIds[0];
    }
    if (slotId != null) {
      const idx = slotIds.indexOf(slotId);
      if (idx >= 0 && salts[idx]) {
        saltHex = salts[idx];
      }
    }
  }

  if (slotId == null || !saltHex) {
    throw new Error(
      "Missing slotId or salt. Provide reveal-config.json or join-info.json.",
    );
  }

  const saltBuf = Buffer.from(saltHex, "hex");
  if (saltBuf.length !== 32) {
    throw new Error("salt must be 32 bytes (hex)");
  }

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

  const remainingAccounts = (revealProof.remainingAccounts || []).map(
    (meta: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
      pubkey: new PublicKey(meta.pubkey),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    }),
  );

  const tx = await program.methods
    .finalizeWinner(
      slotId,
      Array.from(saltBuf),
      revealProof.proof,
      revealProof.stateTreeInfo,
      revealProof.systemAccountsOffset,
    )
    .accounts({
      claimer: wallet.publicKey,
      raffle: rafflePda,
      slots: slotsPda,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

  console.log(`✅ Winner finalized for slot ${slotId}`);
  console.log(
    `🔗 Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
