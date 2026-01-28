import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "crypto";

// Multi-raffle (SOL-based) helper utilities.
// These mirror the on-chain layout in programs/multi_raffle/src/lib.rs
// and are intended for scripts, workers, or frontends that need to
// compose instructions and decode accounts without Anchor.

export const MULTI_RAFFLE_PROGRAM_ID = new PublicKey(
  "2qaxQY3shNquV8STxFPoJW6bL9FUAEzUqinZSP163znG",
);

export const CONFIG_SEED = "config";
export const RAFFLE_SEED = "raffle";
export const SLOTS_SEED = "slots";
export const USER_SEED = "user";
export const TREASURY_SEED = "treasury";

export type MultiRaffleStatus = "Open" | "Filled" | "Drawn" | "Cancelled";

export type RaffleAccount = {
  raffleId: string;
  totalSlots: number;
  maxSlotsPerAddress: number;
  metadataUri: string;
  collection: PublicKey;
  premintContract: boolean;
  premint: boolean;
  autoDraw: boolean;
  autoClaim: boolean;
  prizeType: number;
  prizeAmount: bigint;
  createdAt: bigint;
  expiresAt: bigint;
  status: number;
  soldSlots: number;
  winnerSlot: number;
  winner: PublicKey;
  claimed: boolean;
  bump: number;
};

export type UserRaffleAccount = {
  raffle: PublicKey;
  user: PublicKey;
  slots: number[];
  paid: bigint;
};

// -------------------- PDA helpers --------------------

export function deriveConfigPda(
  programId: PublicKey = MULTI_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId,
  );
}

export function deriveRafflePda(
  raffleId: string,
  programId: PublicKey = MULTI_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(RAFFLE_SEED), Buffer.from(raffleId)],
    programId,
  );
}

export function deriveSlotsPda(
  raffle: PublicKey,
  programId: PublicKey = MULTI_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SLOTS_SEED), raffle.toBuffer()],
    programId,
  );
}

export function deriveUserRafflePda(
  raffle: PublicKey,
  user: PublicKey,
  programId: PublicKey = MULTI_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(USER_SEED), raffle.toBuffer(), user.toBuffer()],
    programId,
  );
}

export function deriveTreasuryPda(
  raffle: PublicKey,
  programId: PublicKey = MULTI_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TREASURY_SEED), raffle.toBuffer()],
    programId,
  );
}

// -------------------- Instruction builders --------------------

function discriminator(name: string): Buffer {
  const preimage = `global:${name}`;
  const h = createHash("sha256").update(preimage).digest();
  return Buffer.from(h.subarray(0, 8));
}

function encodeString(s: string): Buffer {
  const bytes = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

function u32le(v: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0, 0);
  return b;
}

function u64le(v: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v, 0);
  return b;
}

function i64le(v: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(v, 0);
  return b;
}

function encodeVecU32(arr: number[]): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(arr.length >>> 0, 0);
  const parts = arr.map((n) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n >>> 0, 0);
    return b;
  });
  return Buffer.concat([len, ...parts]);
}

export function buildUnsafeHostRaffleIx(args: {
  programId?: PublicKey;
  payer: PublicKey;
  config: PublicKey;
  raffleId: string;
  totalSlots: number;
  maxSlotsPerAddress: number;
  metadataUri: string;
  collection: PublicKey;
  premintContract: boolean;
  premint: boolean;
  prizeType: number;
  prizeAmount: bigint;
  autoDraw: boolean;
  autoClaim: boolean;
  expiresAt: bigint; // unix ts seconds
}): TransactionInstruction {
  const programId = args.programId ?? MULTI_RAFFLE_PROGRAM_ID;
  const [raffle] = deriveRafflePda(args.raffleId, programId);
  const [slots] = deriveSlotsPda(raffle, programId);
  const [userRaffle] = deriveUserRafflePda(raffle, args.payer, programId);
  const [treasury] = deriveTreasuryPda(raffle, programId);

  // Argument order must match Rust:
  // (raffle_id: String,
  //  total_slots: u32,
  //  max_slots_per_address: u32,
  //  metadata_uri: String,
  //  collection: Pubkey,
  //  premint_contract: bool,
  //  premint: bool,
  //  prize_type: u8,
  //  prize_amount: u64,
  //  auto_draw: bool,
  //  auto_claim: bool,
  //  expires_at: i64)
  const data = Buffer.concat([
    discriminator("unsafe_host_raffle"),
    encodeString(args.raffleId),
    u32le(args.totalSlots),
    u32le(args.maxSlotsPerAddress),
    encodeString(args.metadataUri),
    args.collection.toBuffer(),
    Buffer.from([args.premintContract ? 1 : 0]),
    Buffer.from([args.premint ? 1 : 0]),
    Buffer.from([args.prizeType & 0xff]),
    u64le(args.prizeAmount),
    Buffer.from([args.autoDraw ? 1 : 0]),
    Buffer.from([args.autoClaim ? 1 : 0]),
    i64le(args.expiresAt),
  ]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: args.config, isSigner: false, isWritable: false },
      { pubkey: raffle, isSigner: false, isWritable: true },
      { pubkey: slots, isSigner: false, isWritable: true },
      { pubkey: userRaffle, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildUnsafeJoinRaffleIx(args: {
  programId?: PublicKey;
  payer: PublicKey;
  config: PublicKey;
  raffleId: string;
  slotIds: number[]; // 1-based slot indices
  amountLamports: bigint;
}): TransactionInstruction {
  if (!args.slotIds.length) {
    throw new Error("slotIds must not be empty");
  }

  const programId = args.programId ?? MULTI_RAFFLE_PROGRAM_ID;
  const [raffle] = deriveRafflePda(args.raffleId, programId);
  const [slots] = deriveSlotsPda(raffle, programId);
  const [userRaffle] = deriveUserRafflePda(raffle, args.payer, programId);
  const [treasury] = deriveTreasuryPda(raffle, programId);

  const data = Buffer.concat([
    discriminator("unsafe_join_raffle"),
    encodeVecU32(args.slotIds),
    u64le(args.amountLamports),
  ]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: args.config, isSigner: false, isWritable: false },
      { pubkey: raffle, isSigner: false, isWritable: true },
      { pubkey: slots, isSigner: false, isWritable: true },
      { pubkey: userRaffle, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// -------------------- Decoders --------------------

export function decodeRaffleAccount(data: Buffer): RaffleAccount {
  // Skip 8-byte Anchor account discriminator
  let offset = 8;

  const readString = (): string => {
    const len = data.readUInt32LE(offset);
    offset += 4;
    const s = data.slice(offset, offset + len).toString("utf8");
    offset += len;
    return s;
  };

  const raffleId = readString();
  const totalSlots = data.readUInt32LE(offset);
  offset += 4;
  const maxSlotsPerAddress = data.readUInt32LE(offset);
  offset += 4;
  const metadataUri = readString();
  const collection = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const premintContract = data.readUInt8(offset++) !== 0;
  const premint = data.readUInt8(offset++) !== 0;
  const autoDraw = data.readUInt8(offset++) !== 0;
  const autoClaim = data.readUInt8(offset++) !== 0;
  const prizeType = data.readUInt8(offset++);
  const prizeAmount = data.readBigUInt64LE(offset);
  offset += 8;
  const createdAt = data.readBigInt64LE(offset);
  offset += 8;
  const expiresAt = data.readBigInt64LE(offset);
  offset += 8;
  const status = data.readUInt8(offset++);
  const soldSlots = data.readUInt32LE(offset);
  offset += 4;
  const winnerSlot = data.readUInt32LE(offset);
  offset += 4;
  const winner = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const claimed = data.readUInt8(offset++) !== 0;
  const bump = data.readUInt8(offset++);

  return {
    raffleId,
    totalSlots,
    maxSlotsPerAddress,
    metadataUri,
    collection,
    premintContract,
    premint,
    autoDraw,
    autoClaim,
    prizeType,
    prizeAmount,
    createdAt,
    expiresAt,
    status,
    soldSlots,
    winnerSlot,
    winner,
    claimed,
    bump,
  };
}

export function decodeUserRaffleAccount(data: Buffer): UserRaffleAccount {
  let offset = 8; // skip Anchor discriminator

  const raffle = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const user = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const len = data.readUInt32LE(offset);
  offset += 4;
  const slots: number[] = [];
  for (let i = 0; i < len; i++) {
    slots.push(data.readUInt32LE(offset));
    offset += 4;
  }

  const paid = data.readBigUInt64LE(offset);
  offset += 8;

  return { raffle, user, slots, paid };
}

// Convenience helpers for fetching & decoding

export async function fetchRaffleAccount(
  connection: Connection,
  rafflePubkey: PublicKey,
): Promise<RaffleAccount | null> {
  const info = await connection.getAccountInfo(rafflePubkey);
  if (!info) return null;
  return decodeRaffleAccount(Buffer.from(info.data));
}

export async function fetchUserRaffleAccount(
  connection: Connection,
  userRafflePubkey: PublicKey,
): Promise<UserRaffleAccount | null> {
  const info = await connection.getAccountInfo(userRafflePubkey);
  if (!info) return null;
  return decodeUserRaffleAccount(Buffer.from(info.data));
}
