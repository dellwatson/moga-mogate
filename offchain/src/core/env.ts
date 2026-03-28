/**
 * Environment variable utilities
 * Reusable across scripts and services
 */

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} env var is required`);
  }
  return value.trim();
}

export function getBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be "true" or "false"`);
}

export function getBigIntEnv(name: string, fallback: bigint): bigint {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return BigInt(value);
}

export function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return Number(value);
}

export function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) return fallback;
  return value.trim();
}
