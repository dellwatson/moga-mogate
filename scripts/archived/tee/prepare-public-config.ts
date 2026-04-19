import fs from "node:fs";
import path from "node:path";
import * as dotenv from "dotenv";

dotenv.config();

function loadJson(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function main() {
  const raffleId = process.env.RAFFLE_ID;
  if (!raffleId) {
    throw new Error("RAFFLE_ID env var is required");
  }

  const mode = (process.env.RAFFLE_MODE || "slots-only").toLowerCase();
  if (mode !== "slots-only" && mode !== "full") {
    throw new Error("RAFFLE_MODE must be 'slots-only' or 'full'");
  }

  const repoRoot = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "..",
  );
  const raffleDir = path.join(repoRoot, "data", "raffles", raffleId);

  const commitmentsPath =
    process.env.RAFFLE_COMMITMENTS_PATH ||
    path.join(raffleDir, "commitments.json");
  const outputPath =
    process.env.RAFFLE_PUBLIC_CONFIG_PATH ||
    path.join(raffleDir, "public-config.json");

  ensureDir(raffleDir);

  let commitments: string[] = [];
  if (mode === "slots-only") {
    const raw = loadJson(commitmentsPath);
    if (!raw) {
      throw new Error(
        `Commitments file not found at ${commitmentsPath}. Provide RAFFLE_COMMITMENTS_PATH or create it.`,
      );
    }
    if (Array.isArray(raw)) {
      commitments = raw;
    } else if (Array.isArray(raw.commitments)) {
      commitments = raw.commitments;
    } else if (Array.isArray(raw.slotCommitments)) {
      commitments = raw.slotCommitments;
    } else {
      throw new Error(
        "Commitments JSON must be an array or contain commitments/slotCommitments array",
      );
    }
  }

  const expectedTicketsRaw = process.env.RAFFLE_EXPECTED_TICKETS;
  const expectedTickets =
    expectedTicketsRaw && expectedTicketsRaw.length > 0
      ? Number(expectedTicketsRaw)
      : undefined;

  const config: Record<string, unknown> = {
    raffleId,
    mode,
  };

  if (mode === "slots-only") {
    config.commitments = commitments;
  }
  if (expectedTickets !== undefined && !Number.isNaN(expectedTickets)) {
    config.expectedTickets = expectedTickets;
  }

  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
  console.log("Public config written to:", outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
