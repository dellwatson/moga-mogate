import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type FeedEntry = {
  height: number;
  ciphertext: string;
  transitionId?: string;
  outputIndex?: number;
};

export type FeedCache = {
  version: 1;
  network: string;
  endpoint: string;
  programId: string;
  lastHeight: number;
  entries: FeedEntry[];
  updatedAt: string;
};

function safeSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function defaultFeedCachePath(programId: string, network: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const cacheDir = resolve(__dirname, ".cache");
  const name = `record_feed.${safeSlug(network)}.${safeSlug(programId)}.json`;
  return resolve(cacheDir, name);
}

export function loadFeedCache(cachePath: string): FeedCache | null {
  if (!existsSync(cachePath)) return null;
  const raw = readFileSync(cachePath, "utf8");
  const parsed = JSON.parse(raw) as FeedCache;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return null;
  return parsed;
}

export function saveFeedCache(cachePath: string, cache: FeedCache): void {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf8");
}

export function mergeFeedEntries(cache: FeedCache, newEntries: FeedEntry[]): number {
  const seen = new Set(cache.entries.map((e) => e.ciphertext));
  let added = 0;
  for (const entry of newEntries) {
    if (seen.has(entry.ciphertext)) continue;
    seen.add(entry.ciphertext);
    cache.entries.push(entry);
    added += 1;
  }
  return added;
}

