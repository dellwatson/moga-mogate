/**
 * Light Raffle instruction builders (no Anchor required)
 * Based on ts-sdk/src/multiRaffle.ts pattern
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// Light Raffle program ID
export const LIGHT_RAFFLE_PROGRAM_ID = new PublicKey(
  "6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44",
);

export const CONFIG_SEED = "config";
export const RAFFLE_SEED = "raffle";
export const SLOTS_SEED = "slots";
export const USER_SEED = "user";
export const TREASURY_SEED = "treasury";

// -------------------- PDA helpers --------------------

export function deriveConfigPda(
  programId: PublicKey = LIGHT_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId,
  );
}

export function deriveRafflePda(
  raffleId: string,
  programId: PublicKey = LIGHT_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(RAFFLE_SEED), Buffer.from(raffleId)],
    programId,
  );
}

export function deriveSlotsPda(
  raffle: PublicKey,
  programId: PublicKey = LIGHT_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SLOTS_SEED), raffle.toBuffer()],
    programId,
  );
}

export function deriveUserRafflePda(
  raffle: PublicKey,
  user: PublicKey,
  programId: PublicKey = LIGHT_RAFFLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(USER_SEED), raffle.toBuffer(), user.toBuffer()],
    programId,
  );
}

export function deriveTreasuryPda(
  raffle: PublicKey,
  programId: PublicKey = LIGHT_RAFFLE_PROGRAM_ID,
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

export function buildInitializeConfigIx(args: {
  programId?: PublicKey;
  admin: PublicKey;
  config: PublicKey;
  refundFeeBps: number;
}): TransactionInstruction {
  const programId = args.programId ?? LIGHT_RAFFLE_PROGRAM_ID;

  // From IDL: initialize_config takes admin: pubkey, refundFeeBps: u16
  const data = Buffer.concat([
    discriminator("initialize_config"),
    args.admin.toBuffer(), // admin pubkey (32 bytes)
    Buffer.from([args.refundFeeBps & 0xff, (args.refundFeeBps >> 8) & 0xff]), // u16 little endian
  ]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: args.admin, isSigner: true, isWritable: true },
      { pubkey: args.config, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
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
  const programId = args.programId ?? LIGHT_RAFFLE_PROGRAM_ID;
  const [raffle] = deriveRafflePda(args.raffleId, programId);
  const [slots] = deriveSlotsPda(raffle, programId);
  const [treasury] = deriveTreasuryPda(raffle, programId);

  // Match the exact parameter order from the Rust handler
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
  raffle: PublicKey;
  slots: PublicKey;
  userRaffle: PublicKey;
  treasury: PublicKey;
  slotIds: number[];
  amountLamports: bigint;
  lightStateTree: PublicKey;
  lightSystemProgram: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? LIGHT_RAFFLE_PROGRAM_ID;

  // For Light version, include merkle proofs (empty for now)
  const merkleProofs: number[][] = [];

  const data = Buffer.concat([
    discriminator("unsafe_join_raffle"),
    encodeVecU32(args.slotIds),
    u64le(args.amountLamports),
    encodeVecVecU8(merkleProofs), // Add merkle proofs
  ]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: args.config, isSigner: false, isWritable: false },
      { pubkey: args.raffle, isSigner: false, isWritable: true },
      { pubkey: args.slots, isSigner: false, isWritable: true },
      { pubkey: args.userRaffle, isSigner: false, isWritable: true },
      { pubkey: args.lightStateTree, isSigner: false, isWritable: false },
      { pubkey: args.lightSystemProgram, isSigner: false, isWritable: false },
      { pubkey: args.treasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
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

function encodeVecVecU8(arr: number[][]): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(arr.length >>> 0, 0);
  const parts = arr.map((inner) => {
    const innerLen = Buffer.alloc(4);
    innerLen.writeUInt32LE(inner.length >>> 0, 0);
    const innerBytes = Buffer.from(inner);
    return Buffer.concat([innerLen, innerBytes]);
  });
  return Buffer.concat([len, ...parts]);
}

// -------------------- Helper functions --------------------

export async function loadWallet(keypairPath?: string): Promise<Keypair> {
  const walletPath =
    keypairPath || path.join(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync(walletPath, "utf-8")),
  );
  return Keypair.fromSecretKey(secretKey);
}

export async function sendAndConfirm(
  connection: Connection,
  instruction: TransactionInstruction,
  payer: Keypair,
): Promise<string> {
  const transaction = new Transaction().add(instruction);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer.publicKey;

  return await sendAndConfirmTransaction(connection, transaction, [payer], {
    commitment: "confirmed",
    maxRetries: 3,
  });
}
