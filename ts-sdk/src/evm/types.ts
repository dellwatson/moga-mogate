/**
 * Type definitions for Raffle SDK
 */

import type { Contract, Provider, Signer } from "ethers";

export enum PrizeTokenType {
  NONE = 0,
  ERC721 = 1,
  ERC1155 = 2,
  ERC404 = 3,
}

// Client types
export type RaffleClient = {
  provider: Provider;
  signer?: Signer;
  raffle: Contract;
};

export type RaffleClientConfig = {
  rpcUrl: string;
  privateKey?: string;
  raffleAddress: string;
};

export type RaffleClientFromSignerConfig = {
  signer: Signer;
  raffleAddress: string;
};

export type RaffleClientFromProviderConfig = {
  provider: Provider;
  raffleAddress: string;
};

// EIP-712 Domain
export type RaffleEip712Domain = {
  name: string;
  version: string;
  chainId: bigint;
  verifyingContract: string;
};

// Raffle parameter types
export type UnsafeHostRaffleParams = {
  raffleId: string;
  totalSlots: bigint;
  maxSlotsPerAddress: bigint;
  metadataUri: string;
  collection: string;
  premintContract: boolean;
  premint: boolean;
  prizeType: PrizeTokenType;
  prizeAmount: bigint;
  autoDraw: boolean;
  autoClaim: boolean;
  expiresAt: bigint;
};

export type UnsafeJoinRaffleParams = {
  raffleId: string;
  slotIds: bigint[];
  amount: bigint;
  token: string;
};

export type SafeHostRaffleParams = UnsafeHostRaffleParams;

export type SafeJoinRaffleParams = UnsafeJoinRaffleParams;

export type SafeHostAndJoinRaffleParams = SafeHostRaffleParams & {
  slotIds: bigint[];
  amount: bigint;
  token: string;
  bonusFreeSlots: bigint;
};

// Permit types (includes signer address)
export type HostRafflePermit = SafeHostRaffleParams & {
  organizer: string;
};

export type JoinRafflePermit = SafeJoinRaffleParams & {
  payer: string;
};

export type HostAndJoinRafflePermit = SafeHostAndJoinRaffleParams & {
  payer: string;
};

// Report types
export type RaffleLoadReport = {
  totalSlots: string;
  soldSlots: string;
  maxSlotsPerAddress: string;
  metadataUri: string;
  collection: string;
  premintContract: boolean;
  premint: boolean;
  autoDraw: boolean;
  autoClaim: boolean;
  createdAt: number;
  expiresAt: number;
  status: number;
  statusString: string;
  winnerSlot: string;
  winner: string;
  prizeAmount: string;
  prizeType: number;
  prizeTypeString: string;
  claimed: boolean;
};

export type RaffleResultReport = {
  winnerSlot: string;
  winner: string;
  status: number;
  statusString: string;
  claimed: boolean;
  collection: string;
  prizeAmount: string;
  prizeType: number;
  prizeTypeString: string;
};

export type NetworkInfo = {
  chainId: string;
  name: string;
};

export type TransactionReport = {
  network: NetworkInfo;
  signer: string;
  raffleAddress: string;
  raffleId: string;
  raffleBytesId?: string;
  txHash: string;
  blockNumber?: number;
  slotIds?: string[];
  paidAmountWei?: string;
  load: RaffleLoadReport;
  result: RaffleResultReport;
};
