import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createHash } from "crypto";
import { ed25519VerifyIx } from "./solanaKit";
import { deriveRafflePda } from "./index";

export type CreateRaffleDirectArgs = {
  programId: PublicKey;
  organizer: PublicKey;
  escrowMint: PublicKey; // USDC mint
  escrowAta: PublicKey;  // must be owned by raffle PDA
  requiredTickets: bigint;
  deadlineUnixTs: bigint;
  tokenProgram?: PublicKey; // default Tokenkeg
};

export type CreateRaffleWithPermitArgs = CreateRaffleDirectArgs & {
  // Off-chain permit artifacts
  permitMessage: Uint8Array;
  permitSignature: Uint8Array; // ed25519 signature by organizer
  // Optional: nonce and expiry (also passed to program for replay protection)
  permitNonce: Uint8Array; // 16 bytes
  permitExpiryUnixTs: bigint;
};

export type JoinWithMogaArgs = {
  programId: PublicKey;
  payer: PublicKey;
  raffle: PublicKey;
  mogaMint: PublicKey;
  // slot numbers selected by user (0-based or 1-based as per program; to be finalized)
  slots: number[];
  maxMogaIn: bigint; // slippage cap from SDK price quote
};

export type JoinWithTicketArgs = {
  programId: PublicKey;
  payer: PublicKey;
  raffle: PublicKey;
  slots: number[];
  // references/Proofs for MRFT NFTs to burn/accept
  ticketRefs: any[];
};

export async function createDirectRaffleTx(_conn: Connection, _args: CreateRaffleDirectArgs): Promise<Transaction> {
  const { programId, organizer, escrowMint, escrowAta, requiredTickets, deadlineUnixTs } = _args;
  const tokenProgram = _args.tokenProgram ?? new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const [raffle] = deriveRafflePda(programId, escrowMint, organizer);
  const slots = PublicKey.findProgramAddressSync([
    Buffer.from("slots"),
    raffle.toBuffer(),
  ], programId)[0];

  const data = Buffer.concat([
    discriminator("initialize_raffle"),
    u64le(requiredTickets),
    i64le(deadlineUnixTs),
  ]);

  const keys = [
    { pubkey: organizer, isSigner: true, isWritable: true },
    { pubkey: escrowMint, isSigner: false, isWritable: false },
    { pubkey: escrowAta, isSigner: false, isWritable: true },
    { pubkey: raffle, isSigner: false, isWritable: true },
    { pubkey: slots, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId, keys, data });
  return new Transaction().add(ix);
}

export async function collectProceedsTx(
  _conn: Connection,
  programId: PublicKey,
  args: { organizer: PublicKey; raffle: PublicKey; mint: PublicKey; organizerAta: PublicKey; escrowAta: PublicKey; tokenProgram?: PublicKey }
): Promise<Transaction> {
  const tokenProgram = args.tokenProgram ?? new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const keys = [
    { pubkey: args.organizer, isSigner: true, isWritable: true },
    { pubkey: args.raffle, isSigner: false, isWritable: true },
    { pubkey: args.mint, isSigner: false, isWritable: false },
    { pubkey: args.organizerAta, isSigner: false, isWritable: true },
    { pubkey: args.escrowAta, isSigner: false, isWritable: true },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
  ];
  const data = discriminator("collect_proceeds");
  const ix = new TransactionInstruction({ programId, keys, data });
  return new Transaction().add(ix);
}

export async function createRaffleWithPermitTx(_conn: Connection, _args: CreateRaffleWithPermitArgs): Promise<Transaction> {
  const { programId, organizer, escrowMint, escrowAta, requiredTickets, deadlineUnixTs, permitMessage, permitSignature } = _args;
  const tokenProgram = _args.tokenProgram ?? new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const [raffle] = deriveRafflePda(programId, escrowMint, organizer);
  const slots = PublicKey.findProgramAddressSync([
    Buffer.from("slots"),
    raffle.toBuffer(),
  ], programId)[0];

  const edIx = ed25519VerifyIx({
    publicKey: organizer.toBytes(),
    message: permitMessage,
    signature: permitSignature,
  });

  const data = Buffer.concat([
    discriminator("initialize_raffle_with_permit"),
    u64le(requiredTickets),
    i64le(deadlineUnixTs),
    // nonce (16), expiry (i64)
    _args.permitNonce,
    i64le(_args.permitExpiryUnixTs),
  ]);
  const instructionsSysvar = new PublicKey("Sysvar1nstructions1111111111111111111111111");
  const keys = [
    { pubkey: organizer, isSigner: true, isWritable: true },
    { pubkey: escrowMint, isSigner: false, isWritable: false },
    { pubkey: escrowAta, isSigner: false, isWritable: true },
    { pubkey: raffle, isSigner: false, isWritable: true },
    { pubkey: slots, isSigner: false, isWritable: true },
    { pubkey: instructionsSysvar, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
  ];
  const initIx = new TransactionInstruction({ programId, keys, data });
  return new Transaction().add(edIx, initIx);
}

export async function joinWithMogaTx(_conn: Connection, _args: JoinWithMogaArgs): Promise<Transaction> {
  // TODO: build join_with_moga IX (pyth+jupiter feature-gated)
  return new Transaction();
}

export async function joinWithTicketTx(_conn: Connection, _args: JoinWithTicketArgs): Promise<Transaction> {
  // TODO: build join_with_ticket IX (bubblegum burn authority provided)
  return new Transaction();
}

export async function claimRefundTx(
  _conn: Connection,
  programId: PublicKey,
  args: { payer: PublicKey; raffle: PublicKey; mint: PublicKey; payerAta: PublicKey; escrowAta: PublicKey; ticket: PublicKey; tokenProgram?: PublicKey }
): Promise<Transaction> {
  const tokenProgram = args.tokenProgram ?? new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const keys = [
    { pubkey: args.payer, isSigner: true, isWritable: true },
    { pubkey: args.raffle, isSigner: false, isWritable: true },
    { pubkey: args.mint, isSigner: false, isWritable: false },
    { pubkey: args.payerAta, isSigner: false, isWritable: true },
    { pubkey: args.escrowAta, isSigner: false, isWritable: true },
    { pubkey: args.ticket, isSigner: false, isWritable: true },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
  ];
  const data = discriminator("claim_refund");
  const ix = new TransactionInstruction({ programId, keys, data });
  return new Transaction().add(ix);
}

export async function claimWinTx(
  _conn: Connection,
  programId: PublicKey,
  args: { winner: PublicKey; raffle: PublicKey; ticket: PublicKey }
): Promise<Transaction> {
  const keys = [
    { pubkey: args.winner, isSigner: true, isWritable: true },
    { pubkey: args.raffle, isSigner: false, isWritable: true },
    { pubkey: args.ticket, isSigner: false, isWritable: true },
  ];
  const data = discriminator("claim_win");
  const ix = new TransactionInstruction({ programId, keys, data });
  return new Transaction().add(ix);
}

// -------------------- utils --------------------

function discriminator(name: string): Buffer {
  const preimage = `global:${name}`;
  const h = createHash("sha256").update(preimage).digest();
  return Buffer.from(h.subarray(0, 8));
}

function u64le(v: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
}

function i64le(v: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(v);
  return b;
}
