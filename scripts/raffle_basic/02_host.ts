#!/usr/bin/env bun
// Host a private darkpool raffle (unsafe)

import {
  createClientFromArgs,
  ensureFieldSuffix,
  ensureScalarSuffix,
  getArg,
  hasFlag,
  isMain,
  readFileText,
  programNames,
} from "../aleo-utils.ts";
import { hostRaffleUnsafe } from "../../ts-sdk/src/modules/index.ts";
import { getSetupConfig } from "../setup/setup.config.ts";

function resolvePrivateFee(defaultValue: boolean): boolean {
  if (hasFlag("public-fee")) return false;
  if (hasFlag("private-fee")) return true;
  return defaultValue;
}

const cfg = getSetupConfig();
const DEFAULTS = {
  collectionId: cfg.collectionDefaults.collectionId,
  metadataBaseUrl: cfg.collectionDefaults.metadataBaseUrl,
  metadataUrl: cfg.collectionDefaults.metadataUrl,
  totalSlots: "200",
  maxSlotsPerUser: "0",
  edition: "1",
};

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args, then defaults.
const INPUT = {
  // Programs (optional). Leave empty to use ts-sdk defaults.
  raffleProgram: "",
  arc721Program: "",

  // Raffle config
  raffleId: "1", // numeric (will normalize to 1field)
  collectionId: "", // default from scripts/setup/setup.config.ts
  totalSlots: "", // default: 200
  maxSlotsPerUser: "", // default: 0 (no limit)
  metadataHash: "0field",

  // Random seed for draw_raffle. Must be the SAME value used later in 07_draw.ts.
  // Leave empty to default to unix timestamp seconds (demo only).
  seed: "",

  // Prize metadata (must be the SAME value used later in 08_claim.ts)
  metadataBaseUrl: "",
  metadataUrl: "",
  data: "",
  dataFile: "",
  edition: "", // default: 1
  autoDraw: undefined as boolean | undefined,
  autoClaim: undefined as boolean | undefined,
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

function pickNumber(
  value?: string,
  fallback?: string,
  defaultValue?: string,
): number | undefined {
  const raw = pickString(value, fallback, defaultValue);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function resolveOptionalNftData(): string | undefined {
  const dataArg = pickString(INPUT.data, getArg("data"));
  if (dataArg) return dataArg;

  const dataFileArg = pickString(INPUT.dataFile, getArg("data-file"));
  if (dataFileArg) {
    const fileText = readFileText(dataFileArg);
    if (fileText) return fileText;
  }

  return undefined;
}

async function main() {
  const client = await createClientFromArgs();

  const defaultSeed = hasFlag("seed-ms")
    ? Date.now()
    : Math.floor(Date.now() / 1000);

  const raffleIdRaw = pickString(INPUT.raffleId, getArg("id"));
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 1field");
    process.exit(1);
  }

  const raffleId = ensureFieldSuffix(raffleIdRaw);
  const collectionId = ensureFieldSuffix(
    pickString(
      INPUT.collectionId,
      getArg("collection") || getArg("collection-id"),
      DEFAULTS.collectionId,
    ) || DEFAULTS.collectionId,
  );

  const totalSlots = pickNumber(
    INPUT.totalSlots,
    getArg("total"),
    DEFAULTS.totalSlots,
  );
  if (!totalSlots || totalSlots <= 0) {
    console.error("Invalid --total. Example: --total 200");
    process.exit(1);
  }

  const maxSlots =
    pickNumber(
      INPUT.maxSlotsPerUser,
      getArg("max-per"),
      DEFAULTS.maxSlotsPerUser,
    ) || 0;
  const metadataHash = ensureFieldSuffix(
    pickString(INPUT.metadataHash, getArg("metadata"), "0field") || "0field",
  );

  const seedRaw = pickString(INPUT.seed, getArg("seed"));
  const seed = seedRaw ? Number(seedRaw) : defaultSeed;
  if (!Number.isFinite(seed) || seed < 0) {
    console.error("Invalid --seed. Expected a non-negative number (u64).");
    process.exit(1);
  }
  const seedNote = seedRaw
    ? ""
    : hasFlag("seed-ms")
    ? " (default: unix timestamp ms)"
    : " (default: unix timestamp sec)";
  const autoDraw =
    typeof INPUT.autoDraw === "boolean" ? INPUT.autoDraw : hasFlag("auto-draw");
  const autoClaim =
    typeof INPUT.autoClaim === "boolean"
      ? INPUT.autoClaim
      : hasFlag("auto-claim");

  const nftEdition = ensureScalarSuffix(
    pickString(INPUT.edition, getArg("edition"), DEFAULTS.edition) ||
      DEFAULTS.edition,
  );
  const nftData = resolveOptionalNftData();
  const metadataBaseUrl = pickString(
    INPUT.metadataBaseUrl,
    getArg("metadata-base"),
    DEFAULTS.metadataBaseUrl,
  );
  const metadataUrl = pickString(
    INPUT.metadataUrl,
    getArg("metadata-url"),
    DEFAULTS.metadataUrl,
  );
  if (!nftData && !metadataUrl) {
    throw new Error(
      "Missing prize metadata. Provide --metadata-url or --data/--data-file.",
    );
  }

  const raffleProgram = pickString(
    INPUT.raffleProgram,
    getArg("raffle-program"),
  );
  const arc721Program = pickString(
    INPUT.arc721Program,
    getArg("arc721-program"),
  );

  const privateFee =
    typeof INPUT.privateFee === "boolean"
      ? INPUT.privateFee
      : resolvePrivateFee(false);
  const debug = hasFlag("debug");

  const result = await hostRaffleUnsafe(client, {
    raffleId,
    collectionId,
    totalSlots,
    maxSlotsPerAddress: maxSlots,
    metadataHash,
    seed,
    nftData,
    metadataUrl,
    metadataBaseUrl,
    nftEdition,
    autoDraw,
    autoClaim,
    programs: {
      ...(raffleProgram ? { rafflePrivate: raffleProgram } : {}),
      ...(arc721Program ? { arc721Private: arc721Program } : {}),
    },
    privateFee,
  });

  console.log("🎟️  Hosting raffle (unsafe)");
  console.log("============================");
  console.log(`Program:      ${raffleProgram || programNames().rafflePrivate}`);
  console.log(`Raffle ID:    ${raffleId}`);
  console.log(`Collection:   ${collectionId}`);
  console.log(`Total slots:  ${totalSlots}`);
  console.log(`Max per user: ${maxSlots}`);
  console.log(`Metadata:     ${metadataHash}`);
  if (metadataUrl) console.log(`Prize URL:    ${metadataUrl}`);
  console.log(`Edition:      ${nftEdition}`);
  console.log(`Seed:         ${seed}u64${seedNote}`);
  if (debug) {
    console.log(`Seed commit:  ${result.seedCommit}`);
    console.log(`Prize commit: ${result.prizeCommit}`);
  }
  console.log(`Auto draw:    ${autoDraw}`);
  console.log(`Auto claim:   ${autoClaim}`);
  console.log(`Fee:          ${privateFee ? "private" : "public"}`);
  console.log("");

  console.log("✅ Host broadcasted");
  console.log(`Transaction: ${result.txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
