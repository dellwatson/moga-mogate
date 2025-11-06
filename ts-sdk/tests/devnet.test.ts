import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { describe, it, expect } from "bun:test";
import { deriveRafflePda, deriveTicketPda, RAFFLE_SEED, TICKET_SEED } from "../src/index";

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
const PROGRAM_ID_STR = process.env.RWA_RAFFLE_PROGRAM_ID || ""; // set after deploy

describe("devnet smoke", () => {
  it("connects to devnet", async () => {
    const conn = new Connection(RPC_URL, "confirmed");
    const slot = await conn.getSlot();
    expect(typeof slot).toBe("number");
  });

  it("program is deployed (account exists & executable)", async () => {
    expect(PROGRAM_ID_STR).not.toBe("");
    const programId = new PublicKey(PROGRAM_ID_STR);
    const conn = new Connection(RPC_URL, "confirmed");
    const info = await conn.getAccountInfo(programId);
    expect(info).not.toBeNull();
    expect(info?.executable).toBe(true);
  });

  it("derives PDAs deterministically", () => {
    const programId = new PublicKey(PROGRAM_ID_STR || PublicKey.unique().toBase58());
    const mint = PublicKey.unique();
    const organizer = PublicKey.unique();
    const [rafflePda1] = deriveRafflePda(programId, mint, organizer);
    const [rafflePda2] = deriveRafflePda(programId, mint, organizer);
    expect(rafflePda1.toBase58()).toBe(rafflePda2.toBase58());

    const [ticket1] = deriveTicketPda(programId, rafflePda1, organizer, 1n);
    const [ticket2] = deriveTicketPda(programId, rafflePda1, organizer, 1n);
    expect(ticket1.toBase58()).toBe(ticket2.toBase58());

    // seeds sanity
    expect(RAFFLE_SEED).toBe("raffle");
    expect(TICKET_SEED).toBe("ticket");
  });
});
