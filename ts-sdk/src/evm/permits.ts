/**
 * EIP-712 Permit Functions
 * Sign and hash raffle permits
 */

import { ethers } from "ethers";
import type { Signer } from "ethers";
import {
  RAFFLE_EIP712_DOMAIN,
  HOST_RAFFLE_TYPES,
  JOIN_RAFFLE_TYPES,
  HOST_AND_JOIN_RAFFLE_TYPES,
} from "./constants.ts";
import type {
  RaffleClient,
  RaffleEip712Domain,
  HostRafflePermit,
  JoinRafflePermit,
  HostAndJoinRafflePermit,
} from "./types.ts";

/**
 * Build EIP-712 domain for raffle permits
 */
export function buildRaffleDomain(
  chainId: bigint,
  verifyingContract: string,
): RaffleEip712Domain {
  return {
    name: RAFFLE_EIP712_DOMAIN.name,
    version: RAFFLE_EIP712_DOMAIN.version,
    chainId,
    verifyingContract,
  };
}

/**
 * Get raffle domain from client
 */
export async function getRaffleDomainFromClient(
  client: RaffleClient,
): Promise<RaffleEip712Domain> {
  const network = await client.provider.getNetwork();
  const verifyingContract = await client.raffle.getAddress();
  return buildRaffleDomain(network.chainId, verifyingContract);
}

// ============================================================================
// HASH FUNCTIONS
// ============================================================================

/**
 * Hash a host raffle permit
 */
export function hashHostRafflePermit(
  domain: RaffleEip712Domain,
  message: HostRafflePermit,
): string {
  return ethers.TypedDataEncoder.hash(domain, HOST_RAFFLE_TYPES, message);
}

/**
 * Hash a join raffle permit
 */
export function hashJoinRafflePermit(
  domain: RaffleEip712Domain,
  message: JoinRafflePermit,
): string {
  return ethers.TypedDataEncoder.hash(domain, JOIN_RAFFLE_TYPES, message);
}

/**
 * Hash a host-and-join raffle permit
 */
export function hashHostAndJoinRafflePermit(
  domain: RaffleEip712Domain,
  message: HostAndJoinRafflePermit,
): string {
  return ethers.TypedDataEncoder.hash(
    domain,
    HOST_AND_JOIN_RAFFLE_TYPES,
    message,
  );
}

// ============================================================================
// SIGN FUNCTIONS
// ============================================================================

/**
 * Sign a host raffle permit
 */
export async function signHostRafflePermit(
  signer: Signer,
  domain: RaffleEip712Domain,
  message: HostRafflePermit,
): Promise<string> {
  return signer.signTypedData(domain, HOST_RAFFLE_TYPES, message);
}

/**
 * Sign a join raffle permit
 */
export async function signJoinRafflePermit(
  signer: Signer,
  domain: RaffleEip712Domain,
  message: JoinRafflePermit,
): Promise<string> {
  return signer.signTypedData(domain, JOIN_RAFFLE_TYPES, message);
}

/**
 * Sign a host-and-join raffle permit
 */
export async function signHostAndJoinRafflePermit(
  signer: Signer,
  domain: RaffleEip712Domain,
  message: HostAndJoinRafflePermit,
): Promise<string> {
  return signer.signTypedData(domain, HOST_AND_JOIN_RAFFLE_TYPES, message);
}

// ============================================================================
// VERIFY FUNCTIONS
// ============================================================================

/**
 * Verify a host raffle permit signature
 */
export function verifyHostRafflePermit(
  domain: RaffleEip712Domain,
  message: HostRafflePermit,
  signature: string,
): string {
  return ethers.verifyTypedData(domain, HOST_RAFFLE_TYPES, message, signature);
}

/**
 * Verify a join raffle permit signature
 */
export function verifyJoinRafflePermit(
  domain: RaffleEip712Domain,
  message: JoinRafflePermit,
  signature: string,
): string {
  return ethers.verifyTypedData(domain, JOIN_RAFFLE_TYPES, message, signature);
}

/**
 * Verify a host-and-join raffle permit signature
 */
export function verifyHostAndJoinRafflePermit(
  domain: RaffleEip712Domain,
  message: HostAndJoinRafflePermit,
  signature: string,
): string {
  return ethers.verifyTypedData(
    domain,
    HOST_AND_JOIN_RAFFLE_TYPES,
    message,
    signature,
  );
}
