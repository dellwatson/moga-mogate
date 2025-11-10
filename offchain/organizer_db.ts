/**
 * Off-chain organizer management (backend DB + permit signing)
 * 
 * This module manages organizer allowlist and permit signing.
 * For now, we use off-chain verification (backend DB).
 * 
 * FUTURE: On-chain OrganizerRegistry PDA (commented out for later)
 */

import { PublicKey } from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";

// ============================================================================
// ORGANIZER DATABASE (In-memory for demo; use PostgreSQL/MongoDB in production)
// ============================================================================

export interface OrganizerProfile {
  publicKey: string;           // Organizer wallet address
  enterpriseId: string;         // Business partner ID
  tier: "free" | "pro" | "enterprise";
  allowedCollections: string[]; // RWA NFT collection mints they can use as prizes
  active: boolean;
  registeredAt: number;         // Unix timestamp
}

// In-memory store (replace with database in production)
const organizerDb = new Map<string, OrganizerProfile>();

/**
 * Register a new organizer (admin-only operation)
 */
export function registerOrganizer(profile: OrganizerProfile): void {
  if (organizerDb.has(profile.publicKey)) {
    throw new Error(`Organizer ${profile.publicKey} already registered`);
  }
  organizerDb.set(profile.publicKey, profile);
  console.log(`✅ Registered organizer: ${profile.enterpriseId} (${profile.publicKey})`);
}

/**
 * Get organizer profile by public key
 */
export function getOrganizer(publicKey: string): OrganizerProfile | undefined {
  return organizerDb.get(publicKey);
}

/**
 * Check if organizer is active and allowed to create raffles
 */
export function isOrganizerActive(publicKey: string): boolean {
  const profile = organizerDb.get(publicKey);
  return profile?.active ?? false;
}

/**
 * Update organizer status (admin-only)
 */
export function updateOrganizerStatus(publicKey: string, active: boolean): void {
  const profile = organizerDb.get(publicKey);
  if (!profile) {
    throw new Error(`Organizer ${publicKey} not found`);
  }
  profile.active = active;
  console.log(`✅ Updated organizer ${publicKey} active=${active}`);
}

/**
 * List all organizers (admin-only)
 */
export function listOrganizers(): OrganizerProfile[] {
  return Array.from(organizerDb.values());
}

// ============================================================================
// PERMIT SIGNING (Off-chain signature for initialize_raffle_with_permit)
// ============================================================================

export interface RafflePermitRequest {
  organizer: string;           // Organizer public key
  enterpriseId: string;         // Business partner ID
  nonce: string;                // UUID or random bytes (16 bytes hex)
  expiryUnixTs: number;         // Permit expiration timestamp
  raffleConfig: {
    requiredTickets: bigint;
    deadlineUnixTs: bigint;
  };
  autoDraw?: boolean;           // Optional config flag
  ticketMode?: number;          // 0=disabled, 1=require_burn, 2=accept_without_burn
}

/**
 * Build canonical BINARY permit message for signing (wallet signs this bytestring)
 * Layout:
 *   b"RWA_RAFFLE_PERMIT" || organizer(32) || nonce(16) || expiry(i64 LE) ||
 *   required_tickets(u64 LE) || deadline(i64 LE) || program_id(32) || auto_draw(u8) || ticket_mode(u8)
 */
export function buildPermitMessage(req: RafflePermitRequest, programId: string): Uint8Array {
  const organizerPk = new PublicKey(req.organizer);
  const programPk = new PublicKey(programId);
  const nonceBytes = Buffer.from(req.nonce.replace(/-/g, ""), "hex").subarray(0, 16);
  const prefix = Buffer.from("RWA_RAFFLE_PERMIT", "ascii"); // 17 bytes
  const buf = Buffer.alloc(
    prefix.length + 32 + 16 + 8 + 8 + 8 + 32 + 1 + 1
  );
  let off = 0;
  prefix.copy(buf, off); off += prefix.length;
  organizerPk.toBuffer().copy(buf, off); off += 32;
  nonceBytes.copy(buf, off); off += 16;
  buf.writeBigInt64LE(BigInt(req.expiryUnixTs), off); off += 8;
  buf.writeBigUInt64LE(BigInt(req.raffleConfig.requiredTickets), off); off += 8;
  buf.writeBigInt64LE(BigInt(req.raffleConfig.deadlineUnixTs), off); off += 8;
  programPk.toBuffer().copy(buf, off); off += 32;
  buf.writeUInt8(req.autoDraw ? 1 : 0, off); off += 1;
  buf.writeUInt8((req.ticketMode ?? 0) & 0xff, off); off += 1;
  return buf;
}

// NOTE: We DO NOT sign on the backend. The organizer's wallet must sign this message via signMessage.

/**
 * Validate permit request and sign if organizer is active
 */
export function issuePermit(req: RafflePermitRequest, programId: string): {
  message: Uint8Array;
  nonce: Uint8Array;
} {
  // 1. Check organizer is registered and active
  const profile = getOrganizer(req.organizer);
  if (!profile) {
    throw new Error(`Organizer ${req.organizer} not registered`);
  }
  if (!profile.active) {
    throw new Error(`Organizer ${req.organizer} is inactive`);
  }

  // 2. Check expiry is in the future
  const now = Math.floor(Date.now() / 1000);
  if (req.expiryUnixTs <= now) {
    throw new Error("Permit expiry must be in the future");
  }

  // 3. Build canonical message (binary)
  const message = buildPermitMessage(req, programId);

  // 5. Convert nonce to bytes (16 bytes)
  const nonceBytes = Buffer.from(req.nonce.replace(/-/g, ""), "hex").subarray(0, 16);

  console.log(`✅ Prepared permit payload for organizer ${req.enterpriseId} (${req.organizer})`);

  return { message, nonce: nonceBytes };
}

// ============================================================================
// DEMO: Seed some organizers for testing
// ============================================================================

export function seedDemoOrganizers(): void {
  registerOrganizer({
    publicKey: "DemoOrg1111111111111111111111111111111111111",
    enterpriseId: "enterprise-A",
    tier: "enterprise",
    allowedCollections: [
      "RWACollection1111111111111111111111111111111",
      "RWACollection2222222222222222222222222222222",
    ],
    active: true,
    registeredAt: Math.floor(Date.now() / 1000),
  });

  registerOrganizer({
    publicKey: "DemoOrg2222222222222222222222222222222222222",
    enterpriseId: "enterprise-B",
    tier: "pro",
    allowedCollections: [
      "RWACollection3333333333333333333333333333333",
    ],
    active: true,
    registeredAt: Math.floor(Date.now() / 1000),
  });

  console.log("✅ Seeded demo organizers");
}

// ============================================================================
// FUTURE: On-chain OrganizerRegistry PDA (commented out for later)
// ============================================================================

/*
// When you want to move to on-chain verification, uncomment this:

import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";

export async function registerOrganizerOnChain(
  program: Program,
  admin: Keypair,
  organizer: PublicKey,
  tier: number,
  allowedCollections: PublicKey[]
): Promise<void> {
  const [organizerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("organizer"), organizer.toBuffer()],
    program.programId
  );

  await program.methods
    .registerOrganizer(tier, allowedCollections)
    .accounts({
      admin: admin.publicKey,
      organizer,
      organizerProfile,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();

  console.log(`✅ Registered organizer on-chain: ${organizer.toBase58()}`);
}

export async function getOrganizerProfileOnChain(
  program: Program,
  organizer: PublicKey
): Promise<any> {
  const [organizerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("organizer"), organizer.toBuffer()],
    program.programId
  );

  return await program.account.organizerProfile.fetch(organizerProfile);
}
*/
