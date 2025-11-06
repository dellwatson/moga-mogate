import { PublicKey } from "@solana/web3.js";

// Minimal client surface (bun-compatible). Fill in with Anchor IDL wiring in later tasks.
export type InitRaffleArgs = {
  requiredTickets: bigint; // number of tickets required to activate
  deadlineUnixTs: bigint;
};

export type DepositArgs = {
  amount: bigint; // base units; must be whole tokens
  startIndex: bigint; // read on-chain raffle.next_ticket_index
};

export const RAFFLE_SEED = "raffle";
export const TICKET_SEED = "ticket";

export function deriveRafflePda(
  programId: PublicKey,
  mint: PublicKey,
  organizer: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(RAFFLE_SEED), mint.toBuffer(), organizer.toBuffer()],
    programId,
  );
}

export function deriveTicketPda(
  programId: PublicKey,
  raffle: PublicKey,
  owner: PublicKey,
  startIndex: bigint,
): [PublicKey, number] {
  const le8 = Buffer.alloc(8);
  le8.writeBigUInt64LE(startIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TICKET_SEED), raffle.toBuffer(), owner.toBuffer(), le8],
    programId,
  );
}

export function amountForTickets(tickets: bigint, decimals: number): bigint {
  const unit = BigInt(10) ** BigInt(decimals);
  return tickets * unit;
}

export function isWholeTokenAmount(amount: bigint, decimals: number): boolean {
  const unit = BigInt(10) ** BigInt(decimals);
  return amount % unit === 0n;
}

// --- Config and Permit Types ---

export type RefundMode = "Auto" | "SelfService" | "Hybrid";
export type PrizeMode = "PreEscrow" | "MintOnClaim";

export type RaffleConfig = {
  requiredTickets: bigint;
  deadlineUnixTs: bigint;
  autoDrawOnFull?: boolean;
  revealTimeUnixTs?: bigint | null;
  refundMode?: RefundMode;
  prizeMode?: PrizeMode;
};

export type PrizeSpec = {
  collection?: string; // collection mint or verified collection id
  uri?: string; // metadata uri (for MintOnClaim)
};

export type OrganizerPermit = {
  organizer: string; // base58 organizer pubkey
  enterpriseId: string; // arbitrary string/id
  nonce: string; // unique per permit
  expiryUnixTs: string; // seconds as string
  raffleConfig: RaffleConfig;
  prize?: PrizeSpec;
  programId: string; // raffle program id base58
};

// Create a canonical message to sign off-chain (ed25519). On-chain we verify
// the ed25519 signature via the ed25519 program + instructions sysvar.
export function createRafflePermitMessage(permit: OrganizerPermit): Uint8Array {
  // Canonical JSON stringify (stable key order)
  const stable = (obj: any): any => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(stable);
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = stable(obj[k]);
        return acc;
      }, {} as any);
  };
  const canonical = stable(permit);
  const prefix = "MOGA_RAFFLE_PERMIT_v1:";
  const encoded = new TextEncoder().encode(prefix + JSON.stringify(canonical));
  return encoded;
}

export class RwaRaffleClient {
  constructor() {}
  async initializeRaffle(_args: InitRaffleArgs): Promise<void> {}
  async deposit(_args: DepositArgs): Promise<void> {}
  async requestDraw(): Promise<void> {}
  async settleDraw(_winnerTicket: bigint): Promise<void> {}
  async claimRefund(): Promise<void> {}
  async claimWin(): Promise<void> {}
}

// Re-exports for modular SDK usage
export * from "./raffle";
export * from "./tokens";
export * from "./tickets";
export * from "./solanaKit";
export * from "./rwa";
