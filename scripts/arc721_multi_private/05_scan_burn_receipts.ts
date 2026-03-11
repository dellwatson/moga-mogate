#!/usr/bin/env bun
// Scan BurnReceipt records (backend view).

import { createClient } from "../../ts-sdk/src/client.ts";
import { decodeFieldArrayToString } from "../../ts-sdk/src/modules/index.ts";
import { getArg, isMain, programNames } from "../aleo-utils.ts";

function resolveBackendKey(): string {
  const keyArg = getArg("key");
  if (keyArg) return keyArg;

  const keyEnv = getArg("key-env");
  if (keyEnv && process.env[keyEnv]) return String(process.env[keyEnv]);

  if (process.env.ALEO_PVT_KEY_2) return String(process.env.ALEO_PVT_KEY_2);
  if (process.env.ALEO_PVT_KEY) return String(process.env.ALEO_PVT_KEY);

  throw new Error("Missing backend key. Set ALEO_PVT_KEY_2 or pass --key/--key-env.");
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

async function main() {
  const programName = getArg("program") || programNames().arc721Private;
  const recordName = getArg("record") || "BurnReceipt";
  const maxRecords = parseInt(getArg("max") || "20", 10);
  const startHeight = parseInt(getArg("start") || "0", 10);
  const endHeightRaw = getArg("end");
  const endHeight = endHeightRaw ? parseInt(endHeightRaw, 10) : undefined;

  const key = resolveBackendKey();
  const client = createClient(key);

  console.log("🔎 Scanning burn receipts (backend)");
  console.log("===================================");
  console.log(`Account:      ${client.getAddress()}`);
  console.log(`Program:      ${programName}`);
  console.log(`Record:       ${recordName}`);
  console.log(`Max records:  ${maxRecords}`);
  console.log(`Start height: ${startHeight}`);
  if (typeof endHeight === "number") {
    console.log(`End height:   ${endHeight}`);
  }
  console.log("");

  const records = await client.findRecords(
    programName,
    recordName,
    maxRecords,
    startHeight,
    endHeight,
  );

  if (!records.length) {
    console.log("No records found.");
    return;
  }

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const text = typeof record?.toString === "function" ? record.toString() : String(record);
    const nftOwner = extractField(text, "nft_owner");
    const nftCommit = extractField(text, "nft_commit");
    const collectionId = extractField(text, "collection_id");
    const metadata = extractArray(text, "metadata");
    const edition = extractField(text, "edition");

    console.log(`[#${i + 1}] ${text}`);
    if (nftOwner) console.log(`  nft_owner:  ${nftOwner}`);
    if (collectionId) console.log(`  collection: ${collectionId}`);
    if (nftCommit) console.log(`  nft_commit: ${nftCommit}`);
    if (metadata) {
      console.log(`  metadata:   ${metadata}`);
      try {
        const decoded = decodeFieldArrayToString(metadata);
        if (decoded) console.log(`  url:        ${decoded}`);
      } catch {
        // ignore decode errors
      }
    }
    if (edition) console.log(`  edition:    ${edition}`);
    console.log("");
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
