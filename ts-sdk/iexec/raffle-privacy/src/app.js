import fs from "node:fs/promises";
import path from "node:path";
import { ethers } from "ethers";
import { IExecDataProtectorDeserializer } from "@iexec/dataprotector-deserializer";

const DEFAULT_MODE = "slots-only";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [rawKey, rawValue] = arg.slice(2).split("=");
      if (rawValue !== undefined) {
        out[rawKey] = rawValue;
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          out[rawKey] = next;
          i++;
        } else {
          out[rawKey] = true;
        }
      }
    }
  }
  return out;
}

function normalizeHex(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase();
}

function toBigInt(value, fallback = 0n) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function computeMerkleRoot(leaves) {
  if (leaves.length === 0) return ethers.ZeroHash;
  let level = [...leaves].map((l) => normalizeHex(l));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? level[i];
      const [a, b] = left <= right ? [left, right] : [right, left];
      next.push(ethers.keccak256(ethers.concat([a, b])));
    }
    level = next;
  }
  return level[0];
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadPublicConfig() {
  const { IEXEC_INPUT_FILES_NUMBER, IEXEC_IN } = process.env;
  const count = Number(IEXEC_INPUT_FILES_NUMBER || "0");
  for (let i = 1; i <= count; i++) {
    const name = process.env[`IEXEC_INPUT_FILE_NAME_${i}`];
    if (!name) continue;
    if (name.endsWith(".json")) {
      const config = await readJsonIfExists(path.join(IEXEC_IN, name));
      if (config) return config;
    }
  }
  return null;
}

async function readProtectedPayload(deserializer) {
  try {
    const payloadStr = await deserializer.getValue("payload", "string");
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}

async function loadTicketsFromProtectedData() {
  const tickets = [];
  const bulkSize = Number(process.env.IEXEC_BULK_SLICE_SIZE || "0");
  if (bulkSize <= 0) return tickets;

  for (let i = 1; i <= bulkSize; i++) {
    const filename = process.env[`IEXEC_DATASET_${i}_FILENAME`];
    if (!filename) continue;
    const protectedDataPath = path.join(process.env.IEXEC_IN, filename);
    const deserializer = new IExecDataProtectorDeserializer({
      protectedDataPath,
    });
    const payload = await readProtectedPayload(deserializer);
    if (!payload) {
      console.log(`Protected data ${i} missing payload`);
      continue;
    }
    if (Array.isArray(payload.tickets)) {
      tickets.push(...payload.tickets);
    } else {
      tickets.push(payload);
    }
  }
  return tickets;
}

function buildCommitment(raffleIdHash, ticket) {
  return ethers.solidityPackedKeccak256(
    ["bytes32", "uint256", "bytes32", "address"],
    [
      raffleIdHash,
      toBigInt(ticket.slotId),
      ticket.salt,
      ticket.buyer,
    ],
  );
}

function buildFullLeaf(raffleIdHash, ticket, index) {
  const ticketId = ticket.ticketId ?? ticket.slotId ?? index;
  return ethers.solidityPackedKeccak256(
    ["bytes32", "uint256", "bytes32", "address"],
    [raffleIdHash, toBigInt(ticketId), ticket.salt, ticket.buyer],
  );
}

const main = async () => {
  const { IEXEC_OUT, IEXEC_TASK_ID } = process.env;
  let computedJsonObj = {};

  try {
    const args = parseArgs(process.argv.slice(2));
    const publicConfig = await loadPublicConfig();

    const mode =
      (args.mode || publicConfig?.mode || DEFAULT_MODE).toString().toLowerCase();
    const raffleId = args.raffleId || publicConfig?.raffleId;
    if (!raffleId) {
      throw new Error("raffleId is required (args or public config)");
    }

    const raffleIdHash = ethers.id(raffleId);

    const commitmentsInput =
      args.commitments ||
      publicConfig?.commitments ||
      publicConfig?.slotCommitments;
    const commitments = commitmentsInput
      ? JSON.parse(commitmentsInput)
      : [];

    const expectedTickets = publicConfig?.expectedTickets
      ? Number(publicConfig.expectedTickets)
      : 0;

    const protectedTickets = await loadTicketsFromProtectedData();
    if (protectedTickets.length === 0) {
      throw new Error("No protected tickets found");
    }

    let tickets = [];
    let leaves = [];

    if (mode === "slots-only") {
      if (!Array.isArray(commitments) || commitments.length === 0) {
        throw new Error("slots-only requires commitments array (public input)");
      }
      const commitmentSet = new Set(commitments.map(normalizeHex));
      const usedSlots = new Set();

      for (const ticket of protectedTickets) {
        if (ticket.raffleId && ticket.raffleId !== raffleId) {
          continue;
        }
        if (ticket.slotId === undefined || !ticket.salt || !ticket.buyer) {
          continue;
        }
        const slotKey = String(ticket.slotId);
        if (usedSlots.has(slotKey)) {
          throw new Error(`Duplicate slotId detected: ${slotKey}`);
        }
        const commitment = buildCommitment(raffleIdHash, ticket);
        if (!commitmentSet.has(normalizeHex(commitment))) {
          throw new Error(`Commitment not found for slotId ${slotKey}`);
        }
        usedSlots.add(slotKey);
        tickets.push({ ...ticket, commitment });
      }

      tickets.sort((a, b) =>
        normalizeHex(a.commitment).localeCompare(normalizeHex(b.commitment)),
      );
      leaves = tickets.map((t) => t.commitment);
    } else if (mode === "full") {
      let index = 0;
      for (const ticket of protectedTickets) {
        if (ticket.raffleId && ticket.raffleId !== raffleId) {
          continue;
        }
        if (!ticket.salt || !ticket.buyer) {
          continue;
        }
        const leaf = buildFullLeaf(raffleIdHash, ticket, index);
        tickets.push({ ...ticket, leaf });
        index++;
      }
      tickets.sort((a, b) =>
        normalizeHex(a.leaf).localeCompare(normalizeHex(b.leaf)),
      );
      leaves = tickets.map((t) => t.leaf);
    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }

    if (tickets.length === 0) {
      throw new Error("No valid tickets after filtering");
    }
    if (expectedTickets > 0 && tickets.length !== expectedTickets) {
      throw new Error(
        `Ticket count mismatch: expected ${expectedTickets} got ${tickets.length}`,
      );
    }

    const ticketsRoot = computeMerkleRoot(leaves);
    const seed = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes32"],
        [IEXEC_TASK_ID ?? ethers.ZeroHash, raffleIdHash, ticketsRoot],
      ),
    );
    const winnerIndex = Number(BigInt(seed) % BigInt(tickets.length));
    const winnerTicket = tickets[winnerIndex];
    const winner = winnerTicket.buyer;

    const callbackData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256", "bytes32"],
      [raffleIdHash, winner, BigInt(winnerIndex), ticketsRoot],
    );

    const result = {
      raffleId,
      mode,
      ticketCount: tickets.length,
      winner,
      winnerIndex,
      ticketsRoot,
    };

    const resultPath = `${IEXEC_OUT}/result.json`;
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

    computedJsonObj = {
      "deterministic-output-path": resultPath,
      "callback-data": callbackData,
    };
  } catch (e) {
    console.log(e);
    computedJsonObj = {
      "deterministic-output-path": IEXEC_OUT,
      "error-message": e?.message || "Unknown error",
    };
  } finally {
    await fs.writeFile(
      `${IEXEC_OUT}/computed.json`,
      JSON.stringify(computedJsonObj),
    );
  }
};

main();
