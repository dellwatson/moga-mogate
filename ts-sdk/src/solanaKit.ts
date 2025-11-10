import { getAddressEncoder, type Address } from "@solana/addresses";
import type { IInstruction } from "@solana/instructions";
import { getU16Encoder, getU8Encoder, getStructEncoder, fixEncoderSize } from "@solana/codecs";

// Lightweight helpers using Anza Kit for composing sysvar-based instructions.
// Tree-shakable, ESM-first, Bun-compatible.

const ED25519_PROGRAM_ADDRESS = "Ed25519SigVerify111111111111111111111111111" as Address;

/**
 * Build an ed25519 signature verification instruction.
 * The raffle program will verify this instruction via the instructions sysvar.
 */
export function ed25519VerifyIx(args: {
  publicKey: Uint8Array; // 32 bytes
  message: Uint8Array;   // arbitrary length
  signature: Uint8Array; // 64 bytes
}): IInstruction {
  // Ed25519 instruction format (single signature):
  // - num_signatures: u8 (1)
  // - padding: u8 (0)
  // - signature_offset: u16 LE (offset to signature in data)
  // - signature_instruction_index: u16 LE (0xFFFF = inline)
  // - public_key_offset: u16 LE
  // - public_key_instruction_index: u16 LE (0xFFFF = inline)
  // - message_data_offset: u16 LE
  // - message_data_size: u16 LE
  // - message_instruction_index: u16 LE (0xFFFF = inline)
  // - signature: [u8; 64]
  // - public_key: [u8; 32]
  // - message: [u8; message.length]

  const headerSize = 14; // 1 + 1 + 2*6
  const signatureOffset = headerSize;
  const publicKeyOffset = signatureOffset + 64;
  const messageOffset = publicKeyOffset + 32;

  const data = new Uint8Array(headerSize + 64 + 32 + args.message.length);
  let offset = 0;

  // Header
  data[offset++] = 1; // num_signatures
  data[offset++] = 0; // padding
  // signature_offset
  data[offset++] = signatureOffset & 0xff;
  data[offset++] = (signatureOffset >> 8) & 0xff;
  // signature_instruction_index (0xFFFF = inline)
  data[offset++] = 0xff;
  data[offset++] = 0xff;
  // public_key_offset
  data[offset++] = publicKeyOffset & 0xff;
  data[offset++] = (publicKeyOffset >> 8) & 0xff;
  // public_key_instruction_index (0xFFFF = inline)
  data[offset++] = 0xff;
  data[offset++] = 0xff;
  // message_data_offset
  data[offset++] = messageOffset & 0xff;
  data[offset++] = (messageOffset >> 8) & 0xff;
  // message_data_size
  data[offset++] = args.message.length & 0xff;
  data[offset++] = (args.message.length >> 8) & 0xff;
  // message_instruction_index (0xFFFF = inline)
  data[offset++] = 0xff;
  data[offset++] = 0xff;

  // Payload
  data.set(args.signature, signatureOffset);
  data.set(args.publicKey, publicKeyOffset);
  data.set(args.message, messageOffset);

  return {
    programAddress: ED25519_PROGRAM_ADDRESS,
    accounts: [],
    data,
  };
}
