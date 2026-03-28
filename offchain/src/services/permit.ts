/**
 * Permit signing service
 * Handles EIP-712 permit generation for host, join, and host-and-join operations
 */

import { ethers } from "ethers";
import {
  PrizeTokenType,
  buildRaffleDomain,
  hashHostAndJoinRafflePermit,
  hashHostRafflePermit,
  hashJoinRafflePermit,
  signHostAndJoinRafflePermit,
  signHostRafflePermit,
  signJoinRafflePermit,
  type HostAndJoinRafflePermit,
  type HostRafflePermit,
  type JoinRafflePermit,
} from "../../../../ts-sdk/src/evm/index.ts";
import {
  parseAddress,
  parseBigIntLike,
  parseBooleanLike,
  parseNumberLike,
  parseSlotIds,
  parseString,
} from "../core/parsers.ts";
import {
  resolveChainId,
  resolveCollectionAddress,
  resolveNetworkTarget,
  resolveRaffleAddress,
  type NetworkTarget,
} from "../core/network.ts";

export interface DomainInput {
  targetNetwork?: string;
  raffleAddress?: string;
  chainId?: string | number | bigint;
  rpcUrl?: string;
}

export async function resolveDomainInput(input: DomainInput) {
  const target =
    (input.targetNetwork as NetworkTarget) || resolveNetworkTarget();
  const raffleAddress =
    input.raffleAddress !== undefined
      ? parseAddress(input.raffleAddress, "raffleAddress")
      : resolveRaffleAddress(target);

  let chainId: bigint;
  if (input.chainId !== undefined) {
    chainId = parseBigIntLike(input.chainId, "chainId");
  } else if (process.env.CHAIN_ID) {
    chainId = BigInt(process.env.CHAIN_ID);
  } else if (
    input.rpcUrl &&
    typeof input.rpcUrl === "string" &&
    input.rpcUrl.trim().length > 0
  ) {
    const provider = new ethers.JsonRpcProvider(input.rpcUrl);
    const network = await provider.getNetwork();
    chainId = network.chainId;
  } else {
    chainId = await resolveChainId(target);
  }

  return {
    domain: buildRaffleDomain(chainId, raffleAddress),
    target,
  };
}

export interface HostPermitInput extends DomainInput {
  raffleId?: string;
  totalSlots?: string | number | bigint;
  maxSlotsPerAddress?: string | number | bigint;
  metadataUri?: string;
  collection?: string;
  premintContract?: boolean | string;
  premint?: boolean | string;
  prizeType?: number | string;
  prizeAmount?: string | number | bigint;
  autoDraw?: boolean | string;
  autoClaim?: boolean | string;
  expiresAt?: string | number | bigint;
  organizer: string;
}

export async function signHostPermit(
  signer: ethers.Wallet,
  input: HostPermitInput,
) {
  const { domain, target } = await resolveDomainInput(input);
  const collection =
    input.collection !== undefined
      ? parseAddress(input.collection, "collection")
      : resolveCollectionAddress(target);

  const message: HostRafflePermit = {
    raffleId:
      typeof input.raffleId === "string" && input.raffleId.trim().length > 0
        ? input.raffleId
        : `safe-host-${Date.now()}`,
    totalSlots: parseBigIntLike(input.totalSlots ?? 10, "totalSlots"),
    maxSlotsPerAddress: parseBigIntLike(
      input.maxSlotsPerAddress ?? 3,
      "maxSlotsPerAddress",
    ),
    metadataUri:
      typeof input.metadataUri === "string" &&
      input.metadataUri.trim().length > 0
        ? input.metadataUri
        : "https://example.com/raffle-metadata-safe.json",
    collection,
    premintContract: parseBooleanLike(input.premintContract, false),
    premint: parseBooleanLike(input.premint, false),
    prizeType: parseNumberLike(input.prizeType, PrizeTokenType.ERC721),
    prizeAmount: parseBigIntLike(input.prizeAmount ?? 1, "prizeAmount"),
    autoDraw: parseBooleanLike(input.autoDraw, true),
    autoClaim: parseBooleanLike(input.autoClaim, false),
    expiresAt: parseBigIntLike(
      input.expiresAt ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
      "expiresAt",
    ),
    organizer: parseAddress(input.organizer, "organizer"),
  };

  const signature = await signHostRafflePermit(signer, domain, message);
  const digest = hashHostRafflePermit(domain, message);

  return {
    domain,
    message,
    signature,
    digest,
    signer: signer.address,
  };
}

export interface JoinPermitInput extends DomainInput {
  raffleId: string;
  slotIds: unknown;
  amount: string | number | bigint;
  token?: string;
  payer: string;
}

export async function signJoinPermit(
  signer: ethers.Wallet,
  input: JoinPermitInput,
) {
  const { domain } = await resolveDomainInput(input);
  const message: JoinRafflePermit = {
    raffleId: parseString(input.raffleId, "raffleId"),
    slotIds: parseSlotIds(input.slotIds),
    amount: parseBigIntLike(input.amount, "amount"),
    token: parseAddress(input.token ?? ethers.ZeroAddress, "token"),
    payer: parseAddress(input.payer, "payer"),
  };

  const signature = await signJoinRafflePermit(signer, domain, message);
  const digest = hashJoinRafflePermit(domain, message);

  return {
    domain,
    message,
    signature,
    digest,
    signer: signer.address,
  };
}

export interface HostAndJoinPermitInput extends DomainInput {
  raffleId?: string;
  totalSlots?: string | number | bigint;
  maxSlotsPerAddress?: string | number | bigint;
  metadataUri?: string;
  collection?: string;
  premintContract?: boolean | string;
  premint?: boolean | string;
  prizeType?: number | string;
  prizeAmount?: string | number | bigint;
  autoDraw?: boolean | string;
  autoClaim?: boolean | string;
  expiresAt?: string | number | bigint;
  slotIds: unknown;
  amount: string | number | bigint;
  token?: string;
  bonusFreeSlots?: string | number | bigint;
  payer: string;
}

export async function signHostAndJoinPermit(
  signer: ethers.Wallet,
  input: HostAndJoinPermitInput,
) {
  const { domain, target } = await resolveDomainInput(input);
  const collection =
    input.collection !== undefined
      ? parseAddress(input.collection, "collection")
      : resolveCollectionAddress(target);

  const message: HostAndJoinRafflePermit = {
    raffleId:
      typeof input.raffleId === "string" && input.raffleId.trim().length > 0
        ? input.raffleId
        : `safe-host-join-${Date.now()}`,
    totalSlots: parseBigIntLike(input.totalSlots ?? 10, "totalSlots"),
    maxSlotsPerAddress: parseBigIntLike(
      input.maxSlotsPerAddress ?? 3,
      "maxSlotsPerAddress",
    ),
    metadataUri:
      typeof input.metadataUri === "string" &&
      input.metadataUri.trim().length > 0
        ? input.metadataUri
        : "https://example.com/raffle-metadata-safe.json",
    collection,
    premintContract: parseBooleanLike(input.premintContract, false),
    premint: parseBooleanLike(input.premint, false),
    prizeType: parseNumberLike(input.prizeType, PrizeTokenType.ERC721),
    prizeAmount: parseBigIntLike(input.prizeAmount ?? 1, "prizeAmount"),
    autoDraw: parseBooleanLike(input.autoDraw, true),
    autoClaim: parseBooleanLike(input.autoClaim, false),
    expiresAt: parseBigIntLike(
      input.expiresAt ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
      "expiresAt",
    ),
    slotIds: parseSlotIds(input.slotIds),
    amount: parseBigIntLike(input.amount, "amount"),
    token: parseAddress(input.token ?? ethers.ZeroAddress, "token"),
    bonusFreeSlots: parseBigIntLike(
      input.bonusFreeSlots ?? 0,
      "bonusFreeSlots",
    ),
    payer: parseAddress(input.payer, "payer"),
  };

  const signature = await signHostAndJoinRafflePermit(signer, domain, message);
  const digest = hashHostAndJoinRafflePermit(domain, message);

  return {
    domain,
    message,
    signature,
    digest,
    signer: signer.address,
  };
}
