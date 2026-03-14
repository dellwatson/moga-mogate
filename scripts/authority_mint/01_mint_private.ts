#!/usr/bin/env node
// Mint private NFT via authority mint gateway (v5, multi-collection, recipient private)

import {
  createClientFromArgs,
  ensureFieldSuffix,
  ensureScalarSuffix,
  getArg,
  hasFlag,
  readFileText,
  isMain,
} from "../aleo-utils.ts";
import { buildNftDataFromMetadataUrl, joinBaseUrl, mintFaucet } from "../../ts-sdk/src/modules/index.ts";
import { getSetupConfig } from "../setup/setup.config.ts";

const cfg = getSetupConfig();
const DEFAULTS = {
  collectionId: cfg.collectionDefaults.collectionId,
  metadataBaseUrl: cfg.collectionDefaults.metadataBaseUrl,
  metadataUrl: cfg.collectionDefaults.metadataUrl,
  tokenId: "1",
};

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args, then defaults.
const INPUT = {
  collectionId: "",
  to: "",
  tokenId: "",
  metadataUrl: "",
  data: "",
  dataFile: "",
  privateFee: undefined as boolean | undefined,
};

function pickString(
  value?: string,
  fallback?: string,
  defaultValue?: string,
): string | undefined {
  const first = value && value.trim().length ? value : undefined;
  if (first) return first;
  const second = fallback && fallback.trim().length ? fallback : undefined;
  if (second) return second;
  return defaultValue && defaultValue.trim().length ? defaultValue : undefined;
}

function requireNftData(): string {
  const dataArg = pickString(INPUT.data, getArg("data"));
  if (dataArg) return dataArg;

  const dataFileArg = pickString(INPUT.dataFile, getArg("data-file"));
  if (dataFileArg) {
    const fileText = readFileText(dataFileArg);
    if (fileText) return fileText;
  }

  const metadataUrl = pickString(
    INPUT.metadataUrl,
    getArg("metadata-url"),
    DEFAULTS.metadataUrl,
  );
  if (metadataUrl) {
    const base = pickString(getArg("metadata-base"), DEFAULTS.metadataBaseUrl);
    return buildNftDataFromMetadataUrl(joinBaseUrl(base, metadataUrl));
  }

  throw new Error("Missing --data/--data-file or --metadata-url.");
}

async function main() {
  const client = await createClientFromArgs();
  const collectionId = ensureFieldSuffix(
    pickString(
      INPUT.collectionId,
      getArg("collection") || getArg("collection-id"),
      DEFAULTS.collectionId,
    ),
  );
  const to = pickString(INPUT.to, getArg("to"), client.getAddress());
  const tokenId = ensureScalarSuffix(
    pickString(INPUT.tokenId, getArg("token-id") || getArg("edition"), DEFAULTS.tokenId),
  );
  const nftData = requireNftData();
  const privateFee = typeof INPUT.privateFee === "boolean"
    ? INPUT.privateFee
    : hasFlag("private-fee");

  const txId = await mintFaucet(client, {
    collectionId,
    to,
    nftData,
    tokenId,
    privateFee,
  });

  console.log("✅ Gateway mint broadcasted");
  console.log(`Collection: ${collectionId}`);
  console.log(`To:         ${to}`);
  console.log(`TokenId:    ${tokenId}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
