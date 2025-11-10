import { type Address, getAddressEncoder, getAddressDecoder } from "@solana/addresses";
import type { IInstruction } from "@solana/instructions";
import { createHash } from "crypto";
import { ed25519VerifyIx } from "./solanaKit";
import { deriveRafflePda, deriveSlotsPda } from "./index";

export type CreateRaffleDirectArgs = {
  programId: Address;
  organizer: Address;
  escrowMint: Address; // USDC mint
  escrowAta: Address;  // must be owned by raffle PDA
  requiredTickets: bigint;
  deadlineUnixTs: bigint;
  autoDraw: boolean;
  ticketMode: number; // 0=disabled, 1=require_burn, 2=accept_without_burn
  tokenProgram?: Address; // default Tokenkeg
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
  programId: Address;
  payer: Address;
  raffle: Address;
  mogaMint: Address;
  // slot numbers selected by user (0-based or 1-based as per program; to be finalized)
  slots: number[];
  maxMogaIn: bigint; // slippage cap from SDK price quote
};

export type JoinWithTicketArgs = {
  programId: Address;
  payer: Address;
  raffle: Address;
  slots: number[];
  // references/Proofs for MRFT NFTs to burn/accept
  ticketRefs: any[];
};

/**
 * Build initialize_raffle instruction (direct, no permit).
 * Returns a Kit IInstruction that can be added to a transaction.
 */
export async function createDirectRaffleIx(_args: CreateRaffleDirectArgs): Promise<IInstruction> {
  const { programId, organizer, escrowMint, escrowAta, requiredTickets, deadlineUnixTs, autoDraw, ticketMode } = _args;
  const tokenProgram = _args.tokenProgram ?? ("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address);
  const [raffle] = await deriveRafflePda(programId, escrowMint, organizer);
  const [slots] = await deriveSlotsPda(programId, raffle);

  const data = Buffer.concat([
    discriminator("initialize_raffle"),
    u64le(requiredTickets),
    i64le(deadlineUnixTs),
    Buffer.from([autoDraw ? 1 : 0, ticketMode & 0xff]),
  ]);

  return {
    programAddress: programId,
    accounts: [
      { address: organizer, role: 3 /* signer + writable */ },
      { address: escrowMint, role: 0 /* readonly */ },
      { address: escrowAta, role: 1 /* writable */ },
      { address: raffle, role: 1 /* writable */ },
      { address: slots, role: 1 /* writable */ },
      { address: "11111111111111111111111111111111" as Address, role: 0 /* System */ },
      { address: tokenProgram, role: 0 },
    ],
    data,
  };
}

export function collectProceedsIx(
  programId: Address,
  args: { organizer: Address; raffle: Address; mint: Address; organizerAta: Address; escrowAta: Address; tokenProgram?: Address }
): IInstruction {
  const tokenProgram = args.tokenProgram ?? ("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address);
  const data = discriminator("collect_proceeds");
  return {
    programAddress: programId,
    accounts: [
      { address: args.organizer, role: 3 },
      { address: args.raffle, role: 1 },
      { address: args.mint, role: 0 },
      { address: args.organizerAta, role: 1 },
      { address: args.escrowAta, role: 1 },
      { address: tokenProgram, role: 0 },
    ],
    data,
  };
}

/**
 * Build initialize_raffle_with_permit instructions (ed25519 verify + init).
 * Returns array of Kit IInstructions: [ed25519VerifyIx, initRaffleIx]
 */
export async function createRaffleWithPermitIxs(_args: CreateRaffleWithPermitArgs): Promise<IInstruction[]> {
  const { programId, organizer, escrowMint, escrowAta, requiredTickets, deadlineUnixTs, permitMessage, permitSignature, autoDraw, ticketMode } = _args;
  const tokenProgram = _args.tokenProgram ?? ("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address);
  const [raffle] = await deriveRafflePda(programId, escrowMint, organizer);
  const [slots] = await deriveSlotsPda(programId, raffle);

  const encoder = getAddressEncoder();
  const edIx = ed25519VerifyIx({
    publicKey: encoder.encode(organizer),
    message: permitMessage,
    signature: permitSignature,
  });

  const data = Buffer.concat([
    discriminator("initialize_raffle_with_permit"),
    u64le(requiredTickets),
    i64le(deadlineUnixTs),
    _args.permitNonce,
    i64le(_args.permitExpiryUnixTs),
    Buffer.from([autoDraw ? 1 : 0, ticketMode & 0xff]),
  ]);

  const instructionsSysvar = "Sysvar1nstructions1111111111111111111111111" as Address;
  const systemProgram = "11111111111111111111111111111111" as Address;

  const initIx: IInstruction = {
    programAddress: programId,
    accounts: [
      { address: organizer, role: 3 },
      { address: escrowMint, role: 0 },
      { address: escrowAta, role: 1 },
      { address: raffle, role: 1 },
      { address: slots, role: 1 },
      { address: instructionsSysvar, role: 0 },
      { address: systemProgram, role: 0 },
      { address: tokenProgram, role: 0 },
    ],
    data,
  };

  return [edIx, initIx];
}

// NOTE: Additional instruction builders (join, claim, etc.) can be added here.
// For now, the core init + permit builders are migrated to Anza Kit.
// Legacy web3.js-based builders removed for tree-shaking benefits.

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

function encodeVecU32(arr: number[]): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(arr.length);
  const items = Buffer.concat(arr.map(n => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n);
    return b;
  }));
  return Buffer.concat([len, items]);
}

function encodeVecU8(arr: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(arr.length);
  return Buffer.concat([len, Buffer.from(arr)]);
}
