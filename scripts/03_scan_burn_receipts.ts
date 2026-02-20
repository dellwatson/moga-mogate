#!/usr/bin/env bun
// Scan BurnReceipt records owned by this account (backend)

import { createClientFromArgs, getArg, programNames } from "./aleo-utils.ts";

function extractField(raw: string, key: string): string | undefined {
  const regex = new RegExp(`${key}\\s*:\\s*([^,}]+)`);
  const match = raw.match(regex);
  return match ? match[1].trim() : undefined;
}

async function main() {
  const programName = getArg("program") || programNames().arc721Private;
  const recordName = getArg("record") || "BurnReceipt";
  const maxRecords = parseInt(getArg("max") || "20", 10);
  const startHeight = parseInt(getArg("start") || "0", 10);
  const endHeightRaw = getArg("end");
  const endHeight = endHeightRaw ? parseInt(endHeightRaw, 10) : undefined;

  const client = createClientFromArgs();
  console.log("🔎 Scanning burn receipts");
  console.log("================================");
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

    console.log(`[#${i + 1}] ${text}`);
    if (nftOwner) console.log(`  nft_owner:  ${nftOwner}`);
    if (nftCommit) {
      console.log(`  nft_commit: ${nftCommit}`);
      try {
        const content = await client.getProgramMappingValue(
          programName,
          "nft_contents",
          nftCommit,
        );
        console.log(`  content:    ${content}`);
      } catch {
        console.log("  content:    (not published or not found)");
      }
    }
    console.log("");
  }
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
