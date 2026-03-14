#!/usr/bin/env node
// Build/update a local cache of encrypted record outputs for a program (record feed).
// This is program-wide (not per user). Users still decrypt locally with their view key.

import { createClientFromArgs, getArg, isMain, programNames } from "../aleo-utils.ts";
import { getSetupConfig } from "../setup/setup.config.ts";
import { defaultFeedCachePath, loadFeedCache, mergeFeedEntries, saveFeedCache, type FeedCache, type FeedEntry } from "./_feed_cache.ts";

const cfg = getSetupConfig();

// Optional local override. If set, it wins.
const INPUT = {
  program: "",
  cachePath: "",
  start: "",
  end: "",
  maxBlocks: "",
};

function pickString(value?: string, fallback?: string, defaultValue?: string): string | undefined {
  const first = value && value.trim().length ? value : undefined;
  if (first) return first;
  const second = fallback && fallback.trim().length ? fallback : undefined;
  if (second) return second;
  return defaultValue && defaultValue.trim().length ? defaultValue : undefined;
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

async function main() {
  const client = await createClientFromArgs();
  const programId = pickString(INPUT.program, getArg("program"), programNames().arc721Private);
  const networkName = cfg.network.name || "testnet";

  const cachePath = pickString(
    INPUT.cachePath,
    getArg("cache") || getArg("cache-file"),
    defaultFeedCachePath(programId, networkName),
  );

  const existing = loadFeedCache(cachePath);
  const latestHeight = await client.getLatestHeight();
  const deployHeight = parseInt(cfg.scanDefaults.arc721MultiStartHeight || "0", 10);

  const startArg = pickString(INPUT.start, getArg("start"));
  const endArg = pickString(INPUT.end, getArg("end"));
  const maxBlocksArg = pickString(INPUT.maxBlocks, getArg("max-blocks"));
  const maxBlocks = maxBlocksArg ? parseInt(maxBlocksArg, 10) : 0;

  let startHeight = typeof startArg === "string" && startArg.length
    ? parseInt(startArg, 10)
    : (existing ? existing.lastHeight + 1 : deployHeight);
  if (!Number.isFinite(startHeight) || startHeight < 0) startHeight = 0;

  let endHeight = typeof endArg === "string" && endArg.length ? parseInt(endArg, 10) : latestHeight;
  if (!Number.isFinite(endHeight) || endHeight < 0) endHeight = latestHeight;

  if (maxBlocks > 0) {
    endHeight = Math.min(endHeight, startHeight + maxBlocks);
  }

  const cache: FeedCache = existing || {
    version: 1,
    network: networkName,
    endpoint: (cfg.network.endpoint || "").trim(),
    programId,
    lastHeight: (existing?.lastHeight ?? startHeight - 1),
    entries: [],
    updatedAt: new Date(0).toISOString(),
  };

  console.log("📦 Cache record feed");
  console.log("====================");
  console.log(`Program:     ${programId}`);
  console.log(`Network:     ${networkName}`);
  console.log(`Latest:      ${latestHeight}`);
  console.log(`Cache file:  ${cachePath}`);
  console.log(`Have entries:${cache.entries.length}`);
  console.log(`From height: ${startHeight}`);
  console.log(`To height:   ${endHeight}`);
  console.log("");

  if (startHeight > endHeight) {
    console.log("Nothing to do (start > end).");
    return;
  }

  const startMs = Date.now();
  let addedTotal = 0;
  let cursor = startHeight;
  while (cursor <= endHeight) {
    const endExclusive = Math.min(cursor + 50, endHeight + 1);
    const blocks = await client.getBlockRange(cursor, endExclusive);
    const newEntries = collectRecordOutputs(programId, blocks);
    addedTotal += mergeFeedEntries(cache, newEntries);

    const processed = endExclusive - cursor;
    cursor = endExclusive;

    const elapsed = Date.now() - startMs;
    console.log(
      `Processed ${processed} blocks, height < ${cursor} (added ${newEntries.length}, total+${addedTotal}) in ${elapsed}ms`,
    );
  }

  cache.lastHeight = endHeight;
  cache.updatedAt = new Date().toISOString();
  saveFeedCache(cachePath, cache);

  console.log("");
  console.log("✅ Cache updated");
  console.log(`Entries:   ${cache.entries.length}`);
  console.log(`Last height:${cache.lastHeight}`);
  console.log(`Updated:   ${cache.updatedAt}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

