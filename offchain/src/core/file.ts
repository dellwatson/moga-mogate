/**
 * File system utilities
 * Reusable for reading/writing JSON files
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function resolveOutputPath(
  envName: string,
  defaultPathFromScript: string,
): string {
  const fromEnv = process.env[envName];
  if (!fromEnv) return defaultPathFromScript;
  return resolve(process.cwd(), fromEnv);
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

export function readJson<T>(path: string): T {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as T;
}
