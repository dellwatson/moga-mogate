import { type Address, getAddressEncoder, getAddressDecoder } from "@solana/addresses";
import { getProgramDerivedAddress } from "@solana/addresses";

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

export async function deriveRafflePda(
  programId: Address,
  mint: Address,
  organizer: Address,
): Promise<[Address, number]> {
  const encoder = getAddressEncoder();
  const seeds = [
    new TextEncoder().encode(RAFFLE_SEED),
    encoder.encode(mint),
    encoder.encode(organizer),
  ];
  return await getProgramDerivedAddress({ programAddress: programId, seeds });
}

export async function deriveSlotsPda(
  programId: Address,
  raffle: Address,
): Promise<[Address, number]> {
  const encoder = getAddressEncoder();
  const seeds = [
    new TextEncoder().encode("slots"),
    encoder.encode(raffle),
  ];
  return await getProgramDerivedAddress({ programAddress: programId, seeds });
}

export async function deriveTicketPda(
  programId: Address,
  raffle: Address,
  owner: Address,
  startIndex: bigint,
): Promise<[Address, number]> {
  const encoder = getAddressEncoder();
  const le8 = new Uint8Array(8);
  new DataView(le8.buffer).setBigUint64(0, startIndex, true);
  const seeds = [
    new TextEncoder().encode(TICKET_SEED),
    encoder.encode(raffle),
    encoder.encode(owner),
    le8,
  ];
  return await getProgramDerivedAddress({ programAddress: programId, seeds });
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
