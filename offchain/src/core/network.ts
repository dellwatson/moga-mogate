/**
 * Network configuration utilities
 * Reusable for resolving network-specific addresses and RPC URLs
 */

import { ethers } from "ethers";
import { getEnv } from "./env.ts";

export type NetworkTarget = "sepolia" | "arbitrumSepolia" | "polygonAmoy";

export function resolveNetworkTarget(): NetworkTarget {
  const target = getEnv("TARGET_NETWORK", "sepolia");
  if (!["sepolia", "arbitrumSepolia", "polygonAmoy"].includes(target)) {
    throw new Error(`Invalid TARGET_NETWORK: ${target}`);
  }
  return target as NetworkTarget;
}

export function resolveRpcUrl(target: NetworkTarget): string {
  if (process.env.RPC_URL) return process.env.RPC_URL;

  const rpcUrls: Record<NetworkTarget, string> = {
    polygonAmoy:
      process.env.POLYGON_AMOY_RPC_URL ||
      "https://polygon-amoy-bor-rpc.publicnode.com",
    arbitrumSepolia:
      process.env.ARBITRUM_SEPOLIA_RPC_URL ||
      "https://sepolia-rollup.arbitrum.io/rpc",
    sepolia: process.env.SEPOLIA_RPC_URL || "",
  };

  return rpcUrls[target] || "";
}

export function resolveRaffleAddress(target: NetworkTarget): string {
  if (process.env.RAFFLE_ADDRESS) {
    return ethers.getAddress(process.env.RAFFLE_ADDRESS);
  }

  const raffleAddresses: Record<NetworkTarget, string> = {
    polygonAmoy: process.env.RAFFLE_ADDRESS_POLYGON_AMOY || "",
    arbitrumSepolia: process.env.RAFFLE_ADDRESS_ARBITRUM_SEPOLIA || "",
    sepolia: process.env.RAFFLE_ADDRESS_SEPOLIA || "",
  };

  const address = raffleAddresses[target];
  if (!address) {
    throw new Error(
      "Missing raffle address. Set RAFFLE_ADDRESS or network-specific RAFFLE_ADDRESS_* env var",
    );
  }
  return ethers.getAddress(address);
}

export function resolveCollectionAddress(target: NetworkTarget): string {
  if (process.env.COLLECTION_ADDRESS) {
    return ethers.getAddress(process.env.COLLECTION_ADDRESS);
  }

  const collectionAddresses: Record<NetworkTarget, string> = {
    polygonAmoy:
      process.env.COLLECTION_ADDRESS_POLYGON_AMOY || ethers.ZeroAddress,
    arbitrumSepolia:
      process.env.COLLECTION_ADDRESS_ARBITRUM_SEPOLIA || ethers.ZeroAddress,
    sepolia: process.env.COLLECTION_ADDRESS_SEPOLIA || ethers.ZeroAddress,
  };

  return ethers.getAddress(collectionAddresses[target] || ethers.ZeroAddress);
}

export async function resolveChainId(target: NetworkTarget): Promise<bigint> {
  if (process.env.CHAIN_ID) return BigInt(process.env.CHAIN_ID);

  const rpcUrl = resolveRpcUrl(target);
  if (!rpcUrl) {
    throw new Error("CHAIN_ID or RPC_URL/SEPOLIA_RPC_URL env var is required");
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  return network.chainId;
}
