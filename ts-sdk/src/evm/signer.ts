/**
 * Signer Utilities
 * Helper functions for creating and managing signers
 */

import { ethers } from "ethers";
import type { Provider, Signer } from "ethers";

/**
 * Create a signer from a private key
 */
export function createSignerFromPrivateKey(
  privateKey: string,
  provider?: Provider,
): Signer {
  if (provider) {
    return new ethers.Wallet(privateKey, provider);
  }
  return new ethers.Wallet(privateKey);
}

/**
 * Create a signer from a private key and RPC URL
 */
export function createSignerFromRpc(
  privateKey: string,
  rpcUrl: string,
): Signer {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Get address from a signer
 */
export async function getSignerAddress(signer: Signer): Promise<string> {
  return signer.getAddress();
}

/**
 * Check if signer has a provider
 */
export function hasProvider(signer: Signer): boolean {
  return signer.provider !== null && signer.provider !== undefined;
}

/**
 * Create a provider from RPC URL
 */
export function createProvider(rpcUrl: string): Provider {
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get network info from provider
 */
export async function getNetworkInfo(provider: Provider) {
  const network = await provider.getNetwork();
  return {
    chainId: network.chainId,
    name: network.name,
  };
}
