#!/usr/bin/env bun
// Claim raffle prize using winning ticket

import {
  createClientFromArgs,
  ensureScalarSuffix,
  getArg,
  hasFlag,
  isMain,
  readFileText,
  programNames,
} from "../aleo-utils.ts";
import { buildNftDataFromMetadataUrl, claimRafflePrize, joinBaseUrl } from "../../ts-sdk/src/modules/index.ts";
import { getSetupConfig } from "../setup/setup.config.ts";

function resolvePrivateFee(defaultValue: boolean): boolean {
  if (hasFlag("public-fee")) return false;
  if (hasFlag("private-fee")) return true;
  return defaultValue;
}

const cfg = getSetupConfig();
const DEFAULTS = {
  metadataBaseUrl: cfg.collectionDefaults.metadataBaseUrl,
  metadataUrl: cfg.collectionDefaults.metadataUrl,
  edition: "1",
};

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args, then defaults.
const INPUT = {
  raffleProgram: "",
  ticket: "",
  slotId: "",
  collectionId: "",
  metadataBaseUrl: "",
  metadataUrl: "",
  data: "",
  dataFile: "",
  edition: "",
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

  const dataFile = pickString(INPUT.dataFile, getArg("data-file"));
  if (dataFile) {
    const fileText = readFileText(dataFile);
    if (fileText) return fileText;
  }

  const metadataUrl = pickString(
    INPUT.metadataUrl,
    getArg("metadata-url"),
    DEFAULTS.metadataUrl,
  );
  if (metadataUrl) {
    const base = pickString(
      INPUT.metadataBaseUrl,
      getArg("metadata-base"),
      DEFAULTS.metadataBaseUrl,
    );
    return buildNftDataFromMetadataUrl(joinBaseUrl(base, metadataUrl));
  }

  throw new Error("Missing --metadata-url or --data/--data-file for nft_data.");
}

async function main() {
  const ticketRecord = pickString(INPUT.ticket, getArg("ticket")) || process.argv[2];
  if (!ticketRecord) {
    console.error("Usage: bun scripts/raffle_basic/08_claim.ts '<TICKET_RECORD>' --slot <u64>");
    process.exit(1);
  }

  const slotRaw = pickString(INPUT.slotId, getArg("slot"));
  if (!slotRaw) {
    console.error("Missing --slot <u64>");
    process.exit(1);
  }
  const slotId = Number(slotRaw);

  const collectionRaw = pickString(
    INPUT.collectionId,
    getArg("collection") || getArg("collection-id"),
  );
  if (!collectionRaw) {
    console.error("Missing --collection <field> for prize collection_id.");
    process.exit(1);
  }

  const nftData = requireNftData();
  const nftEdition = ensureScalarSuffix(
    pickString(INPUT.edition, getArg("edition"), DEFAULTS.edition) || DEFAULTS.edition,
  );
  const raffleProgram = pickString(INPUT.raffleProgram, getArg("raffle-program"));
  const privateFee = typeof INPUT.privateFee === "boolean"
    ? INPUT.privateFee
    : resolvePrivateFee(true);

  const client = await createClientFromArgs();
  const txId = await claimRafflePrize(client, {
    ticketRecord,
    slotId,
    collectionId: collectionRaw,
    nftData,
    nftEdition,
    programs: raffleProgram ? { rafflePrivate: raffleProgram } : undefined,
    privateFee,
  });

  console.log("✅ Claim broadcasted");
  console.log(`Program: ${raffleProgram || programNames().rafflePrivate}`);
  console.log(`Fee: ${privateFee ? "private" : "public"}`);
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
