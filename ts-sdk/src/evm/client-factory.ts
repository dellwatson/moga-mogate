/**
 * Raffle Client Factory
 * Functions to create RaffleClient instances
 */

import { ethers } from "ethers";
import type { Provider, Signer } from "ethers";
import { RAFFLE_ABI } from "./abi.ts";
import type {
  RaffleClient,
  RaffleClientConfig,
  RaffleClientFromSignerConfig,
  RaffleClientFromProviderConfig,
} from "./types.ts";

/**
 * Get a Raffle contract instance
 */
export function getRaffleContract(
  raffleAddress: string,
  signerOrProvider: Signer | Provider,
) {
  return new ethers.Contract(raffleAddress, RAFFLE_ABI, signerOrProvider);
}

/**
 * Create a RaffleClient from RPC URL and optional private key
 */
export function createRaffleClient(config: RaffleClientConfig): RaffleClient {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = config.privateKey
    ? new ethers.Wallet(config.privateKey, provider)
    : undefined;
  const raffle = getRaffleContract(config.raffleAddress, signer ?? provider);
  return { provider, signer, raffle };
}

/**
 * Create a RaffleClient from an existing Signer
 */
export function createRaffleClientFromSigner(
  config: RaffleClientFromSignerConfig,
): RaffleClient {
  const provider = config.signer.provider;
  if (!provider) {
    throw new Error("Signer must be connected to a provider");
  }
  const raffle = getRaffleContract(config.raffleAddress, config.signer);
  return { provider, signer: config.signer, raffle };
}

/**
 * Create a read-only RaffleClient from a Provider
 */
export function createRaffleClientFromProvider(
  config: RaffleClientFromProviderConfig,
): RaffleClient {
  const raffle = getRaffleContract(config.raffleAddress, config.provider);
  return { provider: config.provider, raffle };
}
