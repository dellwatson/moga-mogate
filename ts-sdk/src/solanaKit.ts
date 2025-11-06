import { TransactionInstruction, createEd25519InstructionWithPublicKey } from "@solana/web3.js";

// Lightweight helpers ("Solana Kit" style wrappers) for composing sysvar-based instructions.
// This avoids extra deps and keeps builders simple.

// Using Web Crypto API ed25519 (when available) or libsodium is out of scope here.
// We accept a precomputed signature and public key to build the ed25519 verification instruction.
// The raffle program will verify this instruction via the instructions sysvar.
export function ed25519VerifyIx(args: {
  publicKey: Uint8Array; // 32 bytes
  message: Uint8Array;   // arbitrary length
  signature: Uint8Array; // 64 bytes
}): TransactionInstruction {
  return createEd25519InstructionWithPublicKey({
    publicKey: args.publicKey,
    message: args.message,
    signature: args.signature,
  });
}
