#!/usr/bin/env node
// List PrivateNFT records for a given account (by private key), using a local
// cached record feed (encrypted outputs) + optional incremental refresh.

import { PrivateKey, ViewKey, RecordCiphertext } from "../../ts-sdk/src/aleo.ts";
import { decodeFieldArrayToString } from "../../ts-sdk/src/modules/index.ts";
import { createClientFromArgs, getArg, hasFlag, isMain, programNames, resolvePrivateKey } from "../aleo-utils.ts";
import { getSetupConfig } from "../setup/setup.config.ts";
import { defaultFeedCachePath, loadFeedCache, mergeFeedEntries, saveFeedCache, type FeedCache, type FeedEntry } from "./_feed_cache.ts";

const cfg = getSetupConfig();

// Optional local override. If set, it wins.
const INPUT = {
  program: "",
  record: "",
  cachePath: "",
  max: "",
  viewKey: "",
  noUpdate: false,
  updateMaxBlocks: "",
  skipSpentCheck: false,
  includeRecord: false,
};

function pickString(value?: string, fallback?: string, defaultValue?: string): string | undefined {
  const first = value && value.trim().length ? value : undefined;
  if (first) return first;
  const second = fallback && fallback.trim().length ? fallback : undefined;
  if (second) return second;
  return defaultValue && defaultValue.trim().length ? defaultValue : undefined;
}

function extractField(raw: string, key: string): string | undefined {
  const regex = new RegExp(`${key}\\s*:\\s*([^,}]+)`);
  const match = raw.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractArray(raw: string, key: string): string | undefined {
  const regex = new RegExp(`${key}\\s*:\\s*\\[([^\\]]+)\\]`);
  const match = raw.match(regex);
  return match ? `[${match[1].trim()}]` : undefined;
}

function extractNestedArray(raw: string, parentKey: string, key: string): string | undefined {
  const regex = new RegExp(
    `${parentKey}\\s*:\\s*\\{[^}]*${key}\\s*:\\s*\\[([^\\]]+)\\]`,
  );
  const match = raw.match(regex);
  return match ? `[${match[1].trim()}]` : undefined;
}

function cleanFieldArray(value?: string): string | undefined {
  if (!value) return value;
  return value.replace(/\.private\b|\.public\b/g, "").replace(/\s+/g, " ").trim();
}

function stripSuffix(value?: string): string | undefined {
  if (!value) return value;
  return value
    .replace(/\.private\b/g, "")
    .replace(/\.public\b/g, "")
    .replace(/\bscalar\b/g, "")
    .replace(/\bfield\b/g, "")
    .replace(/\bgroup\b/g, "")
    .replace(/\bu8\b/g, "")
    .trim();
}

function scalarToNumber(value?: string): string | undefined {
  if (!value) return value;
  const cleaned = stripSuffix(value);
  return cleaned && cleaned.length ? cleaned : value;
}

function compactRecord(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function getTransitionsFromBlock(block: any): any[] {
  const transactions = Array.isArray(block?.transactions) ? block.transactions : [];
  const transitions: any[] = [];
  for (const confirmedTx of transactions) {
    if (confirmedTx?.type !== "execute") continue;
    const tx = confirmedTx?.transaction;
    const exec = tx?.execution;
    const txTransitions = Array.isArray(exec?.transitions) ? exec.transitions : [];
    for (const t of txTransitions) transitions.push(t);
  }
  return transitions;
}

function collectRecordOutputs(programId: string, blocks: any[]): FeedEntry[] {
  const entries: FeedEntry[] = [];
  for (const block of blocks) {
    const height = Number(block?.height);
    const transitions = getTransitionsFromBlock(block);
    for (const transition of transitions) {
      if (transition?.program !== programId) continue;
      const outputs = Array.isArray(transition?.outputs) ? transition.outputs : [];
      for (let outputIndex = 0; outputIndex < outputs.length; outputIndex += 1) {
        const output = outputs[outputIndex];
        if (output?.type !== "record") continue;
        const ciphertext = String(output?.value || "").trim();
        if (!ciphertext) continue;
        entries.push({
          height,
          ciphertext,
          transitionId: transition?.id ? String(transition.id) : undefined,
          outputIndex,
        });
      }
    }
  }
  return entries;
}

async function updateFeedCache(
  client: any,
  cache: FeedCache,
  latestHeight: number,
  maxUpdateBlocks: number,
): Promise<{ scannedBlocks: number; addedEntries: number; updatedTo: number; ms: number }> {
  const startMs = Date.now();
  if (cache.lastHeight >= latestHeight) {
    return { scannedBlocks: 0, addedEntries: 0, updatedTo: cache.lastHeight, ms: 0 };
  }

  let fromHeight = cache.lastHeight + 1;
  let toHeight = latestHeight;
  const gap = toHeight - fromHeight + 1;
  if (maxUpdateBlocks > 0 && gap > maxUpdateBlocks) {
    // Only catch up partially to keep UX snappy. The full backfill should be done by 07_cache_record_feed.ts.
    fromHeight = Math.max(0, toHeight - maxUpdateBlocks + 1);
  }

  let cursor = fromHeight;
  let scannedBlocks = 0;
  let addedEntries = 0;
  while (cursor <= toHeight) {
    const endExclusive = Math.min(cursor + 50, toHeight + 1);
    const blocks = await client.getBlockRange(cursor, endExclusive);
    scannedBlocks += endExclusive - cursor;
    const newEntries = collectRecordOutputs(cache.programId, blocks);
    addedEntries += mergeFeedEntries(cache, newEntries);
    cursor = endExclusive;
  }

  cache.lastHeight = toHeight;
  cache.updatedAt = new Date().toISOString();
  const ms = Date.now() - startMs;
  return { scannedBlocks, addedEntries, updatedTo: toHeight, ms };
}

async function main() {
  const programId = pickString(INPUT.program, getArg("program"), programNames().arc721Private);
  const recordName = pickString(INPUT.record, getArg("record"), "PrivateNFT");
  const maxRecords = parseInt(pickString(INPUT.max, getArg("max"), "50") || "50", 10);
  const networkName = cfg.network.name || "testnet";

  const cachePath = pickString(
    INPUT.cachePath,
    getArg("cache") || getArg("cache-file"),
    defaultFeedCachePath(programId, networkName),
  );

  const client = await createClientFromArgs();
  const viewKeyArg = pickString(INPUT.viewKey, getArg("view-key"));
  let viewKey: any;
  let viewKeySource = "";
  let privateKey: any | undefined;
  if (viewKeyArg) {
    viewKey = ViewKey.from_string(viewKeyArg);
    viewKeySource = "arg:--view-key";
  } else {
    const privateKeyString = resolvePrivateKey();
    privateKey = PrivateKey.from_string(privateKeyString);
    viewKey = privateKey.to_view_key();
    viewKeySource = "env/arg private key";
  }

  const latestHeight = await client.getLatestHeight();
  const deployHeight = parseInt(cfg.scanDefaults.arc721MultiStartHeight || "0", 10);
  const updateMaxRaw = pickString(INPUT.updateMaxBlocks, getArg("update-max-blocks"));
  const updateMaxBlocks = updateMaxRaw
    ? parseInt(updateMaxRaw, 10)
    : parseInt(cfg.scanDefaults.arc721MultiRecentBlocks || "5000", 10);

  const noUpdate = INPUT.noUpdate || hasFlag("no-update");
  const includeRecord = INPUT.includeRecord || hasFlag("include-record");
  let skipSpentCheck = INPUT.skipSpentCheck || hasFlag("skip-spent-check");
  if (!skipSpentCheck && !privateKey) {
    // View-key only mode can't compute serial numbers (spent check requires the spending key).
    skipSpentCheck = true;
  }

  let cache = loadFeedCache(cachePath);
  if (!cache) {
    cache = {
      version: 1,
      network: networkName,
      endpoint: (cfg.network.endpoint || "").trim(),
      programId,
      lastHeight: Math.max(0, deployHeight - 1),
      entries: [],
      updatedAt: new Date(0).toISOString(),
    };
  }

  console.log("🔎 Listing private NFTs (cached feed)");
  console.log("====================================");
  console.log(`Account:     ${client.getAddress()}`);
  console.log(`View key:    ${viewKeySource}`);
  console.log(`Program:     ${programId}`);
  console.log(`Record:      ${recordName}`);
  console.log(`Cache file:  ${cachePath}`);
  console.log(`Cache height:${cache.lastHeight}`);
  console.log(`Cache entries:${cache.entries.length}`);
  console.log(`Latest height:${latestHeight}`);
  console.log(`Max output:  ${maxRecords}`);
  console.log("");

  if (!noUpdate) {
    const update = await updateFeedCache(client, cache, latestHeight, updateMaxBlocks);
    if (update.scannedBlocks > 0 || update.addedEntries > 0) {
      console.log("Cache refresh:");
      console.log(`- scanned blocks: ${update.scannedBlocks}`);
      console.log(`- added entries:  ${update.addedEntries}`);
      console.log(`- updated to:     ${update.updatedTo}`);
      console.log(`- time:           ${update.ms}ms`);
      saveFeedCache(cachePath, cache);
      console.log("");
    }
  }

  if (!cache.entries.length) {
    console.log("No cached record outputs yet.");
    console.log("Run 07_cache_record_feed.ts to backfill history.");
    return;
  }

  const decryptStart = Date.now();
  const ownedCandidates: Array<{ plaintext: any; plaintextText: string; nonce: string }> = [];
  let checkedCiphertexts = 0;

  // Iterate newest-first to find current records sooner.
  for (let i = cache.entries.length - 1; i >= 0; i -= 1) {
    const entry = cache.entries[i];
    checkedCiphertexts += 1;

    try {
      const ciphertext = RecordCiphertext.fromString(entry.ciphertext);
      if (!ciphertext.isOwner(viewKey)) continue;
      const plaintext = ciphertext.decrypt(viewKey);
      const plaintextText = typeof plaintext?.toString === "function" ? plaintext.toString() : String(plaintext);

      // Filter only PrivateNFT-looking records (data.metadata nested).
      const metadataRaw = extractNestedArray(plaintextText, "data", "metadata");
      if (!metadataRaw) continue;

      const nonce = typeof plaintext?.nonce === "function" ? String(plaintext.nonce()) : "";
      ownedCandidates.push({ plaintext, plaintextText, nonce });
    } catch {
      // Ignore parse/decrypt errors for unrelated outputs.
    }
  }
  const decryptMs = Date.now() - decryptStart;

  const spentStart = Date.now();
  const results: Array<Record<string, string>> = [];
  for (const item of ownedCandidates) {
    if (results.length >= maxRecords) break;

    const text = item.plaintextText;
    const collectionId = stripSuffix(extractField(text, "collection_id"));
    const tokenId = scalarToNumber(extractField(text, "token_id"));
    const metadataRaw = extractNestedArray(text, "data", "metadata");
    const metadata = cleanFieldArray(metadataRaw);

    let url = "";
    if (metadata) {
      try {
        url = decodeFieldArrayToString(metadata) || "";
      } catch {
        url = "";
      }
    }

    let spent = false;
    if (!skipSpentCheck) {
      try {
        const recordViewKey = item.plaintext.recordViewKey(viewKey).toString();
        const serialNumber = item.plaintext.serialNumberString(
          privateKey,
          programId,
          recordName,
          recordViewKey,
        );
        await client.getTransitionId(serialNumber);
        spent = true;
      } catch {
        spent = false;
      }
    }

    if (spent) continue;

    const compact = compactRecord(text);
    const out: Record<string, string> = {
    };
    if (includeRecord) out.record = compact;
    if (collectionId) out.collection = collectionId;
    if (tokenId) out.token_id = tokenId;
    if (url) out.url = url;
    if (item.nonce) out.nonce = item.nonce;
    results.push(out);
  }
  const spentMs = Date.now() - spentStart;

  console.log("Stats:");
  console.log(`- cached ciphertexts checked: ${checkedCiphertexts}`);
  console.log(`- owned candidates:          ${ownedCandidates.length}`);
  console.log(`- unspent NFTs:              ${results.length}`);
  console.log(`- decrypt time:              ${decryptMs}ms`);
  console.log(`- spent-check time:          ${skipSpentCheck ? "skipped" : `${spentMs}ms`}`);
  console.log("");

  if (!results.length) {
    console.log("No unspent PrivateNFT records found for this key.");
    return;
  }

  for (let i = 0; i < results.length; i += 1) {
    const item = results[i];
    console.log(`[#${i + 1}] collection=${item.collection || "?"} token_id=${item.token_id || "?"}`);
    if (item.url) console.log(`  url:    ${item.url}`);
    if (item.nonce) console.log(`  nonce:  ${item.nonce}`);
    console.log("");
  }

  console.log("Summary (copy-friendly):");
  console.log(JSON.stringify(results, null, 2));
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
