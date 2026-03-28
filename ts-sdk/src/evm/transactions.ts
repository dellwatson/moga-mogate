/**
 * Raffle Transaction Functions
 * Functions to execute raffle transactions
 */

import type {
  RaffleClient,
  UnsafeHostRaffleParams,
  UnsafeJoinRaffleParams,
  SafeHostRaffleParams,
  SafeJoinRaffleParams,
  SafeHostAndJoinRaffleParams,
  TransactionReport,
} from "./types.ts";
import {
  parseRaffleLoadDetail,
  parseRaffleResult,
  getRaffleBytesId,
} from "./utils.ts";

// ============================================================================
// UNSAFE TRANSACTIONS (No permit required)
// ============================================================================

/**
 * Host a raffle without permit (unsafe)
 */
export async function unsafeHostRaffleWithReport(
  client: RaffleClient,
  params: UnsafeHostRaffleParams,
): Promise<TransactionReport> {
  if (!client.signer) {
    throw new Error("unsafeHostRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.unsafeHostRaffle(
    params.raffleId,
    params.totalSlots,
    params.maxSlotsPerAddress,
    params.metadataUri,
    params.collection,
    params.premintContract,
    params.premint,
    params.prizeType,
    params.prizeAmount,
    params.autoDraw,
    params.autoClaim,
    params.expiresAt,
  );
  const receipt = await tx.wait();

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    raffleBytesId: getRaffleBytesId(params.raffleId),
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    load: parseRaffleLoadDetail(load),
    result: parseRaffleResult(result),
  };
}

/**
 * Join a raffle without permit (unsafe)
 */
export async function unsafeJoinRaffleWithReport(
  client: RaffleClient,
  params: UnsafeJoinRaffleParams,
  valueOverride?: bigint,
): Promise<TransactionReport> {
  if (!client.signer) {
    throw new Error("unsafeJoinRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.unsafeJoinRaffle(
    params.raffleId,
    params.slotIds,
    params.amount,
    params.token,
    { value: valueOverride ?? params.amount },
  );
  const receipt = await tx.wait();

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    slotIds: params.slotIds.map((s) => s.toString()),
    paidAmountWei: params.amount.toString(),
    load: parseRaffleLoadDetail(load),
    result: parseRaffleResult(result),
  };
}

// ============================================================================
// SAFE TRANSACTIONS (With permit)
// ============================================================================

/**
 * Host a raffle with permit (safe)
 */
export async function hostRaffleWithPermit(
  client: RaffleClient,
  params: SafeHostRaffleParams,
  signature: string,
): Promise<TransactionReport> {
  if (!client.signer) {
    throw new Error("hostRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.hostRaffle(
    params.raffleId,
    params.totalSlots,
    params.maxSlotsPerAddress,
    params.metadataUri,
    params.collection,
    params.premintContract,
    params.premint,
    params.prizeType,
    params.prizeAmount,
    params.autoDraw,
    params.autoClaim,
    params.expiresAt,
    signature,
  );
  const receipt = await tx.wait();

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    raffleBytesId: getRaffleBytesId(params.raffleId),
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    load: parseRaffleLoadDetail(load),
    result: parseRaffleResult(result),
  };
}

/**
 * Join a raffle with permit (safe)
 */
export async function joinRaffleWithPermit(
  client: RaffleClient,
  params: SafeJoinRaffleParams,
  signature: string,
  valueOverride?: bigint,
): Promise<TransactionReport> {
  if (!client.signer) {
    throw new Error("joinRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.joinRaffle(
    params.raffleId,
    params.slotIds,
    params.amount,
    params.token,
    signature,
    { value: valueOverride ?? params.amount },
  );
  const receipt = await tx.wait();

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    slotIds: params.slotIds.map((s) => s.toString()),
    paidAmountWei: params.amount.toString(),
    load: parseRaffleLoadDetail(load),
    result: parseRaffleResult(result),
  };
}

/**
 * Host and join a raffle with permit (safe)
 */
export async function hostAndJoinRaffleWithPermit(
  client: RaffleClient,
  params: SafeHostAndJoinRaffleParams,
  signature: string,
  valueOverride?: bigint,
): Promise<TransactionReport> {
  if (!client.signer) {
    throw new Error("hostAndJoinRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.hostAndJoinRaffle(
    params.raffleId,
    params.totalSlots,
    params.maxSlotsPerAddress,
    params.metadataUri,
    params.collection,
    params.premintContract,
    params.premint,
    params.prizeType,
    params.prizeAmount,
    params.autoDraw,
    params.autoClaim,
    params.expiresAt,
    params.slotIds,
    params.amount,
    params.token,
    params.bonusFreeSlots,
    signature,
    { value: valueOverride ?? params.amount },
  );
  const receipt = await tx.wait();

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    raffleBytesId: getRaffleBytesId(params.raffleId),
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    slotIds: params.slotIds.map((s) => s.toString()),
    paidAmountWei: params.amount.toString(),
    load: parseRaffleLoadDetail(load),
    result: parseRaffleResult(result),
  };
}
