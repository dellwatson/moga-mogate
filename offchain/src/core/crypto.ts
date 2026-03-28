/**
 * Cryptographic utilities
 * Reusable for key management and address derivation
 */

import { ethers } from "ethers";

export function resolvePrivateKey(
  primaryKeyName: string,
  fallbackEnvNames: string[] = [],
): string {
  const names = [primaryKeyName, ...fallbackEnvNames];
  for (const envName of names) {
    const value = process.env[envName];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  throw new Error(`${names.join(" or ")} env var is required`);
}

export function resolveAddressFromEnvOrPk(
  addressEnvName: string,
  privateKeyEnvName: string,
): string | undefined {
  const address = process.env[addressEnvName];
  if (address && address.trim().length > 0) {
    return ethers.getAddress(address);
  }

  const pk = process.env[privateKeyEnvName];
  if (pk && pk.trim().length > 0) {
    return ethers.getAddress(new ethers.Wallet(pk.trim()).address);
  }
  return undefined;
}
