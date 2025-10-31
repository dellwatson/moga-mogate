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

export class RwaRaffleClient {
  constructor() {}
  async initializeRaffle(_args: InitRaffleArgs): Promise<void> {}
  async deposit(_args: DepositArgs): Promise<void> {}
  async requestDraw(): Promise<void> {}
  async settleDraw(_winnerTicket: bigint): Promise<void> {}
  async claimRefund(): Promise<void> {}
  async claimWin(): Promise<void> {}
}
