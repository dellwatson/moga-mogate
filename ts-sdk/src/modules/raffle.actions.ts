import {
  type AleoClientLike,
  ensureFieldSuffix,
  ensureScalarSuffix,
  formatU64Array,
  getPrograms,
  type ProgramOverrides,
} from "./shared.js";

export type InitializeRaffleInput = {
  admin?: string;
  backend?: string;
  treasury?: string;
  programs?: ProgramOverrides;
  priorityFee?: number;
  privateFee?: boolean;
};

export async function initializeRafflePrivate(
  client: AleoClientLike,
  input: InitializeRaffleInput = {},
): Promise<string> {
  const programs = getPrograms(input.programs);
  const admin = input.admin || client.getAddress();
  const backend = input.backend || admin;
  const treasury = input.treasury || admin;
  return client.executeBroadcast(
    programs.rafflePrivate,
    "initialize",
    [admin, backend, treasury],
    input.priorityFee || 0,
    input.privateFee || false,
  );
}

export type HostRaffleUnsafeInput = {
  raffleId: string;
  totalSlots: number;
  maxSlotsPerAddress?: number;
  metadataHash?: string;
  seed: number;
  nftData: string;
  nftEdition?: string;
  autoDraw?: boolean;
  autoClaim?: boolean;
  programs?: ProgramOverrides;
  priorityFee?: number;
  privateFee?: boolean;
};

export type HostRaffleUnsafeResult = {
  txId: string;
  raffleId: string;
  seedCommit: string;
  prizeCommit: string;
};

export async function hostRaffleUnsafe(
  client: AleoClientLike,
  input: HostRaffleUnsafeInput,
): Promise<HostRaffleUnsafeResult> {
  const programs = getPrograms(input.programs);
  const raffleId = ensureFieldSuffix(input.raffleId);
  const metadataHash = ensureFieldSuffix(input.metadataHash || "0field");
  const nftEdition = ensureScalarSuffix(input.nftEdition || "1");

  const [seedCommit] = await client.executeOffline(
    programs.rafflePrivate,
    "compute_seed_commit",
    [raffleId, `${input.seed}u64`],
  );
  const [prizeCommit] = await client.executeOffline(
    programs.arc721Private,
    "compute_nft_commit",
    [input.nftData, nftEdition],
  );

  const txId = await client.executeBroadcast(
    programs.rafflePrivate,
    "unsafe_host_raffle",
    [
      raffleId,
      `${input.totalSlots}u64`,
      `${input.maxSlotsPerAddress || 0}u64`,
      metadataHash,
      prizeCommit,
      seedCommit,
      input.autoDraw ? "true" : "false",
      input.autoClaim ? "true" : "false",
    ],
    input.priorityFee || 0,
    input.privateFee || false,
  );

  return { txId, raffleId, seedCommit, prizeCommit };
}

export type JoinRaffleUnsafeInput = {
  raffleId: string;
  slots: number[];
  priceMicroPerSlot?: number;
  priceCreditsPerSlot?: number;
  amountMicro?: number;
  paymentRecord?: string;
  programs?: ProgramOverrides;
  priorityFee?: number;
  privateFee?: boolean;
};

export type JoinRaffleUnsafeResult = {
  txId: string;
  amountMicro: number;
  raffleId: string;
  slots: number[];
};

export async function joinRaffleUnsafe(
  client: AleoClientLike,
  input: JoinRaffleUnsafeInput,
): Promise<JoinRaffleUnsafeResult> {
  const programs = getPrograms(input.programs);
  const raffleId = ensureFieldSuffix(input.raffleId);
  const slots = input.slots;
  if (!slots.length) throw new Error("slots is required");
  if (slots.length > 8) throw new Error("Max 8 slots per join");

  const microPerSlot = input.priceMicroPerSlot
    || Math.round((input.priceCreditsPerSlot ?? 1.5) * 1_000_000);
  const amountMicro = input.amountMicro ?? microPerSlot * slots.length;

  let paymentRecord = input.paymentRecord;
  if (!paymentRecord) {
    const found = await client.findCreditsRecord(amountMicro);
    paymentRecord = typeof found?.toString === "function"
      ? found.toString()
      : String(found);
  }

  const txId = await client.executeBroadcast(
    programs.rafflePrivate,
    "unsafe_join_raffle",
    [
      raffleId,
      formatU64Array(slots, 8),
      `${slots.length}u8`,
      paymentRecord,
      `${amountMicro}u64`,
    ],
    input.priorityFee || 0,
    input.privateFee || false,
  );

  return { txId, amountMicro, raffleId, slots };
}

export type DrawRaffleInput = {
  raffleId: string;
  seed: number;
  programs?: ProgramOverrides;
  priorityFee?: number;
  privateFee?: boolean;
};

export async function drawRaffle(
  client: AleoClientLike,
  input: DrawRaffleInput,
): Promise<string> {
  const programs = getPrograms(input.programs);
  const raffleId = ensureFieldSuffix(input.raffleId);
  return client.executeBroadcast(
    programs.rafflePrivate,
    "draw_raffle",
    [raffleId, `${input.seed}u64`],
    input.priorityFee || 0,
    input.privateFee || false,
  );
}

export type ClaimRafflePrizeInput = {
  ticketRecord: string;
  slotId: number;
  nftData: string;
  nftEdition?: string;
  programs?: ProgramOverrides;
  priorityFee?: number;
  privateFee?: boolean;
};

export async function claimRafflePrize(
  client: AleoClientLike,
  input: ClaimRafflePrizeInput,
): Promise<string> {
  const programs = getPrograms(input.programs);
  const edition = ensureScalarSuffix(input.nftEdition || "1");
  return client.executeBroadcast(
    programs.rafflePrivate,
    "claim_prize",
    [input.ticketRecord, `${input.slotId}u64`, input.nftData, edition],
    input.priorityFee || 0,
    input.privateFee || false,
  );
}

