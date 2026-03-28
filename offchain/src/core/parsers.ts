/**
 * Input parsing utilities
 * Reusable for validating and parsing request inputs
 */

import { ethers } from "ethers";

export function parseBigIntLike(value: unknown, fieldName: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.trim().length > 0)
    return BigInt(value);
  throw new Error(`${fieldName} must be bigint-compatible`);
}

export function parseBooleanLike(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  throw new Error("boolean field must be true/false");
}

export function parseNumberLike(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0)
    return Number(value);
  throw new Error("number field must be number-like");
}

export function parseString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

export function parseAddress(value: unknown, fieldName: string): string {
  return ethers.getAddress(parseString(value, fieldName));
}

export function parseSlotIds(value: unknown): bigint[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("slotIds must be a non-empty array");
  }
  return value.map((slot, index) => parseBigIntLike(slot, `slotIds[${index}]`));
}

export function resolveSlotIds(
  envName: string,
  fallbackCsv: string = "1",
): bigint[] {
  const slotIdsRaw = process.env[envName] || fallbackCsv;
  const slotIds = slotIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => BigInt(s));

  if (slotIds.length === 0) {
    throw new Error(`${envName} cannot be empty`);
  }
  return slotIds;
}
