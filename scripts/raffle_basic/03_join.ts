#!/usr/bin/env bun
// Join private raffle (unsafe, batch)

import {
  createClientFromArgs,
  ensureFieldSuffix,
  getArg,
  hasFlag,
  isMain,
  parseCsvU64,
  programNames,
} from "../aleo-utils.ts";
import { joinRaffleUnsafe } from "../../ts-sdk/src/modules/index.ts";

function parseCreditsToMicrocredits(raw?: string): number | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const [wholeRaw, fracRaw = ""] = s.split(".");
  const whole = BigInt(wholeRaw || "0");
  const frac = (fracRaw + "000000").slice(0, 6);
  const micro = whole * 1_000_000n + BigInt(frac || "0");
  const asNumber = Number(micro);
  if (!Number.isSafeInteger(asNumber)) {
    throw new Error(`Price too large to fit JS number safely: ${s}`);
  }
  return asNumber;
}

function resolvePrivateFee(defaultValue: boolean): boolean {
  if (hasFlag("public-fee")) return false;
  if (hasFlag("private-fee")) return true;
  return defaultValue;
}

const DEFAULTS = {
  raffleId: "",
  // IMPORTANT: price is PER SLOT (in ALEO).
  price: "0.01",
};

// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args, then defaults.
const INPUT = {
  raffleProgram: "", // optional override
  raffleId: "", // numeric (will normalize to 1field)
  slots: [] as number[], // Example: [1,2,5]
  // Price PER SLOT in ALEO (string). Example: "0.01"
  price: "",
  // Optional override if you want to input microcredits directly.
  // Example: "10000" (microcredits) = 0.01 ALEO
  priceMicro: "",
  // Optional record scan overrides (blocks). Normally you can just use CLI flags:
  //   --skip-recent 500 --scan-window 5000
  startHeight: "",
  endHeight: "",
  skipRecentBlocks: "",
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

function extractMicrocreditsFromRecord(raw: string): number | undefined {
  const match = raw.match(/microcredits\s*:\s*(\d+)u64/);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const client = await createClientFromArgs();
  const dryRun = hasFlag("dry-run") || hasFlag("no-broadcast");
  const endpointBase =
    String(process.env.ALEO_ENDPOINT || process.env.ENDPOINT || "").trim() ||
    "(default)";
  const endpointHost =
    typeof (client as any)?.getEndpoint === "function"
      ? String((client as any).getEndpoint())
      : "";
  if (
    endpointHost.includes("/testnet/testnet") ||
    endpointHost.includes("/mainnet/mainnet")
  ) {
    console.error("❌ Bad --endpoint value (network duplicated).");
    console.error(
      "Pass the base host WITHOUT /testnet, e.g. --endpoint https://api.explorer.provable.com/v2",
    );
    process.exit(1);
  }

  const raffleIdRaw = pickString(
    INPUT.raffleId,
    getArg("id"),
    DEFAULTS.raffleId,
  );
  if (!raffleIdRaw) {
    console.error("Missing --id <field>. Example: --id 2field");
    process.exit(1);
  }
  const raffleId = ensureFieldSuffix(raffleIdRaw);

  const slots = INPUT.slots.length ? INPUT.slots : parseCsvU64(getArg("slots"));
  if (!slots.length) {
    console.error("Missing --slots <csv>. Example: --slots 1,2,3");
    process.exit(1);
  }
  if (slots.length > 8) {
    console.error("Max 8 slots per join.");
    process.exit(1);
  }

  // Backwards-compat: some earlier local objects used `priceCredits` / `priceMicrocredits`.
  const legacyPriceCredits = (INPUT as any).priceCredits as string | undefined;
  const legacyPriceMicro = (INPUT as any).priceMicrocredits as string | undefined;

  const priceMicroRaw = pickString(
    INPUT.priceMicro,
    getArg("price-micro"),
    legacyPriceMicro,
  );
  const priceRaw = pickString(INPUT.price, getArg("price"), legacyPriceCredits)
    || DEFAULTS.price;

  const microPerSlot = priceMicroRaw
    ? (() => {
        const n = Number(priceMicroRaw);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(
            `Invalid --price-micro value. Expected a positive integer microcredits, got: ${priceMicroRaw}`,
          );
        }
        return Math.floor(n);
      })()
    : (parseCreditsToMicrocredits(priceRaw) ?? parseCreditsToMicrocredits(DEFAULTS.price)!);
  const amountMicro = microPerSlot * slots.length;

  const raffleProgram = pickString(
    INPUT.raffleProgram,
    getArg("raffle-program"),
  );
  const privateFee =
    typeof INPUT.privateFee === "boolean"
      ? INPUT.privateFee
      : resolvePrivateFee(true);
  const skipRecentBlocks = pickNumber(
    INPUT.skipRecentBlocks,
    getArg("skip-recent"),
  );
  const recordStartHeight = pickNumber(
    INPUT.startHeight,
    getArg("start-height"),
  );
  const recordEndHeight = pickNumber(INPUT.endHeight, getArg("end-height"));

  const publicBalanceMicro = await client.getBalance();
  const publicBalanceAleo = publicBalanceMicro / 1_000_000;

  let latestHeight = 0;
  try {
    latestHeight = await client.getLatestHeight();
  } catch {
    latestHeight = 0;
  }

  const scanWindow = Math.max(
    1,
    Math.floor(Number(process.env.ALEO_RECORD_SCAN_WINDOW || "5000")),
  );
  const skipRecentEnv = Math.max(
    0,
    Math.floor(Number(process.env.ALEO_RECORD_SKIP_RECENT_BLOCKS || "0")),
  );

  const effectiveEndHeight = typeof recordEndHeight === "number"
    ? recordEndHeight
    : latestHeight
    ? Math.max(0, latestHeight - (typeof skipRecentBlocks === "number"
      ? skipRecentBlocks
      : skipRecentEnv))
    : undefined;
  const effectiveStartHeight = typeof recordStartHeight === "number"
    ? recordStartHeight
    : typeof effectiveEndHeight === "number"
    ? Math.max(0, effectiveEndHeight - scanWindow)
    : undefined;

  console.log("🎟️  Joining raffle (unsafe)");
  console.log("===========================");
  console.log(`Program:    ${raffleProgram || programNames().rafflePrivate}`);
  console.log(
    `Address:    ${
      typeof (client as any)?.getAddress === "function"
        ? (client as any).getAddress()
        : "(unknown)"
    }`,
  );
  console.log(`Endpoint:   ${endpointHost || "(unknown)"}`);
  console.log(`Endpoint*:  ${endpointBase} (base)`);
  if (latestHeight) console.log(`Height:     ${latestHeight}`);
  console.log(
    `Balance:    ${publicBalanceMicro} (public microcredits) ≈ ${publicBalanceAleo} ALEO`,
  );
  try {
    const listRecords =
      hasFlag("list-records") ||
      hasFlag("list-private") ||
      process.env.ALEO_LIST_RECORDS === "true";
    const creditRecords = await client.findRecords(
      "credits.aleo",
      "credits",
      25,
      effectiveStartHeight,
      effectiveEndHeight,
    );
    const microValues = creditRecords
      .map((r) => (typeof (r as any)?.toString === "function" ? (r as any).toString() : String(r)))
      .map((raw) => extractMicrocreditsFromRecord(raw))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
    const sum = microValues.reduce((acc, v) => acc + v, 0);
    const max = microValues.reduce((acc, v) => (v > acc ? v : acc), 0);
    console.log(
      `Private*:   ${microValues.length} records (scan window), sum ≈ ${
        sum / 1_000_000
      } ALEO, max ≈ ${max / 1_000_000} ALEO`,
    );
    if (listRecords && microValues.length) {
      const sorted = [...microValues].sort((a, b) => b - a);
      sorted.forEach((v, idx) => {
        console.log(
          `  [#${idx + 1}] ${v} microcredits (≈ ${v / 1_000_000} ALEO)`,
        );
      });
    }
  } catch {
    console.log("Private*:   (unable to scan private credits records)");
  }
  console.log(`Raffle ID:  ${raffleId}`);
  console.log(`Slots:      ${slots.join(", ")}`);
  console.log(`Count:      ${slots.length}`);
  console.log(
    `Price in:   ${priceMicroRaw ? `${priceMicroRaw} microcredits` : `${priceRaw} ALEO`} (per slot)`,
  );
  console.log(
    `Price/slot: ${microPerSlot} (microcredits) ≈ ${microPerSlot / 1_000_000} ALEO`,
  );
  console.log(
    `Amount:     ${amountMicro} (microcredits) ≈ ${amountMicro / 1_000_000} ALEO`,
  );
  console.log(`Fee:        ${privateFee ? "private" : "public"}`);
  if (typeof effectiveStartHeight === "number") {
    console.log(`Start height:${effectiveStartHeight} (record search)`);
  }
  if (typeof effectiveEndHeight === "number") {
    console.log(`End height:  ${effectiveEndHeight} (record search)`);
  }
  if (process.env.ALEO_RECORD_SCAN_WINDOW) {
    console.log(
      `Scan window:${process.env.ALEO_RECORD_SCAN_WINDOW} blocks (record search)`,
    );
  }
  if (typeof skipRecentBlocks === "number") {
    console.log(`Skip recent:${skipRecentBlocks} blocks (record search)`);
  }
  console.log("");

  let paymentRecord: string | undefined;
  try {
    const found = await client.findCreditsRecord(amountMicro, {
      startHeight: effectiveStartHeight,
      endHeight: effectiveEndHeight,
    });
    paymentRecord = typeof found?.toString === "function" ? found.toString() : String(found);
    const recordMicro = extractMicrocreditsFromRecord(paymentRecord);
    if (typeof recordMicro === "number") {
      console.log(
        `🔎 Payment record: ${recordMicro} microcredits ≈ ${recordMicro / 1_000_000} ALEO`,
      );
      console.log("");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("record not found")) {
      console.error("");
      console.error("💡 Record not found (Aleo private credits):");
      console.error(
        "- Ticket payment ALWAYS uses a private `credits.aleo/credits` record (UTXO-style), even with `--public-fee`.",
      );
      console.error(
        `- Required amount: ${amountMicro} microcredits (≈ ${
          amountMicro / 1_000_000
        } ALEO).`,
      );
      console.error(
        "- Common causes: wrong account (--account 2/3), scan window too small, or price per slot is higher than you think.",
      );
      console.error(
        "- Fix: try `--scan-window 50000` (or set `ALEO_RECORD_SCAN_WINDOW=50000`), and ensure `--price 0.01` is PER SLOT.",
      );
    }
    throw error;
  }

  if (dryRun) {
    console.log("Dry run: skipping broadcast (--dry-run/--no-broadcast).");
    return;
  }

  let result: Awaited<ReturnType<typeof joinRaffleUnsafe>>;
  try {
    result = await joinRaffleUnsafe(client, {
      raffleId,
      slots,
      priceMicroPerSlot: microPerSlot,
      amountMicro,
      ...(paymentRecord ? { paymentRecord } : {}),
      ...(typeof skipRecentBlocks === "number"
        ? { recordSkipRecentBlocks: skipRecentBlocks }
        : {}),
      ...(typeof recordStartHeight === "number" ? { recordStartHeight } : {}),
      ...(typeof recordEndHeight === "number" ? { recordEndHeight } : {}),
      programs: raffleProgram ? { rafflePrivate: raffleProgram } : undefined,
      privateFee,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("record not found")) {
      console.error("");
      console.error("💡 Record not found (Aleo private credits):");
      console.error(
        "- Ticket payment uses a private `credits.aleo/credits` record (UTXO-style).",
      );
      console.error(
        "- This is required even when you use `--public-fee` (public fee only affects the network fee).",
      );
      if (privateFee) {
        console.error(
          "- You also selected `--private-fee`, so the NETWORK fee needs private credits too.",
        );
        console.error("- Quick test: retry with `--public-fee`.");
      }
      console.error(
        "- Fix: increase the scan window, e.g. `--scan-window 50000`, or set `ALEO_RECORD_SCAN_WINDOW` in `.env`.",
      );
      console.error(
        "- Also verify `Address:` matches the wallet/account that actually has PRIVATE ALEO.",
      );
    }
    throw error;
  }

  console.log("✅ Join broadcasted");
  console.log(`Transaction: ${result.txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
