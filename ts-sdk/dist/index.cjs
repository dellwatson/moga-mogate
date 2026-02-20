var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ALEO_CONFIG: () => ALEO_CONFIG,
  AleoNFTClient: () => AleoNFTClient,
  claimRafflePrize: () => claimRafflePrize,
  createClient: () => createClient,
  drawRaffle: () => drawRaffle,
  ensureFieldSuffix: () => ensureFieldSuffix,
  ensureScalarSuffix: () => ensureScalarSuffix,
  formatU64Array: () => formatU64Array,
  getPrivateKey: () => getPrivateKey,
  getProgramPath: () => getProgramPath,
  getPrograms: () => getPrograms,
  getRaffleDetail: () => getRaffleDetail,
  getRaffleSlots: () => getRaffleSlots,
  getUserTickets: () => getUserTickets,
  hostRaffleUnsafe: () => hostRaffleUnsafe,
  initializeRafflePrivate: () => initializeRafflePrivate,
  joinRaffleUnsafe: () => joinRaffleUnsafe,
  mintFaucet: () => mintFaucet,
  mintPrivateViaGateway: () => mintPrivateViaGateway,
  parseStructFields: () => parseStructFields,
  raffleStatusLabel: () => raffleStatusLabel
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var AleoSDK = __toESM(require("@provablehq/sdk"), 1);

// src/config.ts
var import_dotenv = require("dotenv");
var import_url = require("url");
var import_path = require("path");
var import_meta = {};
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = (0, import_path.dirname)(__filename);
(0, import_dotenv.config)({ path: (0, import_path.join)(__dirname, "../../.env") });
var ALEO_CONFIG = {
  network: "testnet",
  endpoint: "https://api.provable.com/v2",
  // Program names
  programs: {
    arc721Private: "mogate_arc721_private.aleo",
    rafflePrivate: "mogate_darkpool_raffle_private.aleo",
    gateway: "mogate_authority_mint_v3.aleo",
    // Legacy (kept for reference)
    collection: {
      v1: "mogate_nft_collection_rwa.aleo",
      v2: "mogate_nft_collection_rwa_v2.aleo"
    },
    gatewayLegacy: {
      v1: "mogate_authority_mint_gateway.aleo",
      v2: "mogate_authority_mint_v2.aleo",
      v3: "mogate_authority_mint_v3.aleo"
    }
  },
  // Deployment info
  deployments: {
    collection_v1: {
      programName: "mogate_nft_collection_rwa.aleo",
      transactionId: "at1as952eycv6h7ypdph0rj8tfzr0c89arg7gtsyztsr8x08n9hkc9sf62wjd",
      status: "deployed"
    },
    collection_v2: {
      programName: "mogate_nft_collection_rwa_v2.aleo",
      status: "pending"
      // Failed with HTTP 500, needs retry
    },
    gateway_v2: {
      programName: "mogate_authority_mint_v2.aleo",
      transactionId: "at1h5uauul7hvn63qpka495vxtpglgvfjkp4y5eh06cdwqwtrznwv8qrkl2uj",
      status: "deployed"
    }
  }
};
function getPrivateKey() {
  const key = process.env.PRIVATE_KEY || process.env.ALEO_PVT_KEY;
  if (!key) {
    throw new Error("PRIVATE_KEY or ALEO_PVT_KEY environment variable not set");
  }
  return key;
}
function getProgramPath(program) {
  const base = process.cwd();
  if (program === "collection") {
    return `${base}/programs/collection`;
  }
  if (program === "arc721Private") {
    return `${base}/programs/arc721_collection_private`;
  }
  if (program === "rafflePrivate") {
    return `${base}/programs/dark_pool_raffle_private`;
  }
  return `${base}/programs/authority_mint_gateway`;
}

// src/client.ts
var {
  Account,
  ProgramManager,
  ProgramManagerBase,
  AleoNetworkClient,
  NetworkRecordProvider,
  AleoKeyProvider
} = AleoSDK;
var AleoNFTClient = class {
  constructor(privateKey) {
    const key = privateKey || getPrivateKey();
    this.account = new Account({ privateKey: key });
    this.networkClient = new AleoNetworkClient(ALEO_CONFIG.endpoint);
    this.keyProvider = new AleoKeyProvider();
    this.keyProvider.useCache(true);
    this.recordProvider = new NetworkRecordProvider(
      this.account,
      this.networkClient
    );
    this.programManager = new ProgramManager(
      ALEO_CONFIG.endpoint,
      this.keyProvider,
      this.recordProvider
    );
    this.programManager.setAccount(this.account);
  }
  // Get account address
  getAddress() {
    return this.account.address().to_string();
  }
  // Get account balance
  async getBalance() {
    try {
      const balance = await this.networkClient.getBalance(this.getAddress());
      return parseFloat(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      return 0;
    }
  }
  // Execute a transition (local, not broadcast)
  async execute(programName, functionName, inputs, fee = 0) {
    try {
      console.log("DEBUG: Executing with inputs:", inputs);
      const transaction = await this.programManager.buildExecutionTransaction({
        programName,
        functionName,
        fee,
        privateFee: false,
        inputs
      });
      console.log("DEBUG: Transaction built successfully:", transaction);
      return transaction.toString();
    } catch (error) {
      console.error(`Error executing ${programName}/${functionName}:`, error);
      throw error;
    }
  }
  // Execute and broadcast a transition
  async executeBroadcast(programName, functionName, inputs, priorityFee = 0, privateFee = false) {
    try {
      const txId = await this.programManager.execute({
        programName,
        functionName,
        inputs,
        priorityFee,
        privateFee
      });
      return txId;
    } catch (error) {
      console.error(`Error broadcasting ${programName}/${functionName}:`, error);
      throw error;
    }
  }
  // Execute a transition offline and return its outputs (no broadcast)
  async executeOffline(programName, functionName, inputs) {
    try {
      const programSource = await this.networkClient.getProgram(programName);
      let imports = {};
      try {
        imports = await this.networkClient.getProgramImports(programName);
      } catch {
        imports = {};
      }
      const privateKey = this.account.privateKey();
      const executionResponse = await ProgramManagerBase.executeFunctionOffline(
        privateKey,
        programSource,
        functionName,
        inputs,
        false,
        false,
        imports
      );
      const outputs = executionResponse.getOutputs();
      return outputs.map(
        (output) => typeof output?.toString === "function" ? output.toString() : String(output)
      );
    } catch (error) {
      console.error(
        `Error executing offline ${programName}/${functionName}:`,
        error
      );
      throw error;
    }
  }
  // Deploy a program
  async deploy(programPath, fee = 10) {
    try {
      const txId = await this.programManager.deploy(
        programPath,
        fee,
        false
        // Not offline
      );
      return txId;
    } catch (error) {
      console.error("Error deploying program:", error);
      throw error;
    }
  }
  async getProgramMappingValue(programName, mappingName, key) {
    const encodedKey = encodeURIComponent(key);
    return this.networkClient.getProgramMappingValue(
      programName,
      mappingName,
      encodedKey
    );
  }
  async getProgramSource(programName) {
    return this.networkClient.getProgram(programName);
  }
  async getProgramImports(programName) {
    return this.networkClient.getProgramImports(programName);
  }
  async findCreditsRecord(microcredits) {
    return this.recordProvider.findCreditsRecord(microcredits, true, []);
  }
  // Mint NFT through authority gateway (owner only)
  async mintAuthority(toAddress, uriHash, tokenId) {
    const programName = ALEO_CONFIG.programs.gatewayLegacy.v2;
    const inputs = [`${toAddress}`, `${uriHash}field`, `${tokenId}u64`];
    return this.execute(programName, "mint", inputs);
  }
  // Mint NFT through faucet (public)
  async mintFaucet(toAddress, uriHash) {
    const programName = ALEO_CONFIG.programs.gatewayLegacy.v2;
    return this.execute(programName, "mint_nft", [toAddress, uriHash]);
  }
  // Mint NFT directly from collection (public, bypasses gateway)
  async mintDirect(toAddress, uriHash) {
    const programName = ALEO_CONFIG.programs.collection.v2;
    return this.execute(programName, "mint_to", [toAddress, uriHash]);
  }
  // Initialize gateway with owner
  async initializeGateway(ownerAddress) {
    const programName = ALEO_CONFIG.programs.gatewayLegacy.v2;
    return this.execute(programName, "initialize", [ownerAddress]);
  }
  // Get transaction status
  async getTransaction(txId) {
    try {
      return await this.networkClient.getTransaction(txId);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      return null;
    }
  }
  // Find records for a given program + record name (owned by this account)
  async findRecords(programName, recordName, maxRecords = 20, startHeight = 0, endHeight) {
    const params = {
      programName,
      recordName,
      maxRecords,
      startHeight
    };
    if (typeof endHeight === "number") {
      params.endHeight = endHeight;
    }
    try {
      return await this.recordProvider.findRecords(true, [], params);
    } catch (error) {
      console.error("Error fetching records:", error);
      return [];
    }
  }
};
function createClient(privateKey) {
  return new AleoNFTClient(privateKey);
}

// src/modules/shared.ts
function getPrograms(overrides) {
  return {
    arc721Private: overrides?.arc721Private || ALEO_CONFIG.programs.arc721Private,
    rafflePrivate: overrides?.rafflePrivate || ALEO_CONFIG.programs.rafflePrivate,
    gateway: overrides?.gateway || ALEO_CONFIG.programs.gateway
  };
}
function ensureFieldSuffix(value) {
  return value.endsWith("field") ? value : `${value}field`;
}
function ensureScalarSuffix(value) {
  return value.endsWith("scalar") ? value : `${value}scalar`;
}
function formatU64Array(values, length) {
  const padded = Array.from({ length }, (_, i) => values[i] ?? 0);
  return `[${padded.map((n) => `${n}u64`).join(", ")}]`;
}
function parseStructFields(raw) {
  const trimmed = raw.trim();
  const bodyStart = trimmed.indexOf("{");
  const bodyEnd = trimmed.lastIndexOf("}");
  if (bodyStart === -1 || bodyEnd === -1) return {};
  const body = trimmed.slice(bodyStart + 1, bodyEnd);
  const matches = body.match(/\w+\s*:\s*[^,]+/g) || [];
  const fields = {};
  for (const match of matches) {
    const [key, value] = match.split(":").map((part) => part.trim());
    if (key && value) fields[key] = value;
  }
  return fields;
}
function raffleStatusLabel(status) {
  switch (status) {
    case "0u8":
      return "OPEN";
    case "1u8":
      return "FILLED";
    case "2u8":
      return "DRAWN";
    case "3u8":
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}

// src/modules/mint.ts
async function mintPrivateViaGateway(client, input) {
  const programs = getPrograms(input.programs);
  const to = input.to || client.getAddress();
  const edition = ensureScalarSuffix(input.nftEdition || "1");
  return client.executeBroadcast(
    programs.gateway,
    "mint_private",
    [to, input.nftData, edition],
    input.priorityFee || 0,
    input.privateFee || false
  );
}
async function mintFaucet(client, input) {
  return mintPrivateViaGateway(client, input);
}

// src/modules/raffle.actions.ts
async function initializeRafflePrivate(client, input = {}) {
  const programs = getPrograms(input.programs);
  const admin = input.admin || client.getAddress();
  const backend = input.backend || admin;
  const treasury = input.treasury || admin;
  return client.executeBroadcast(
    programs.rafflePrivate,
    "initialize",
    [admin, backend, treasury],
    input.priorityFee || 0,
    input.privateFee || false
  );
}
async function hostRaffleUnsafe(client, input) {
  const programs = getPrograms(input.programs);
  const raffleId = ensureFieldSuffix(input.raffleId);
  const metadataHash = ensureFieldSuffix(input.metadataHash || "0field");
  const nftEdition = ensureScalarSuffix(input.nftEdition || "1");
  const [seedCommit] = await client.executeOffline(
    programs.rafflePrivate,
    "compute_seed_commit",
    [raffleId, `${input.seed}u64`]
  );
  const [prizeCommit] = await client.executeOffline(
    programs.arc721Private,
    "compute_nft_commit",
    [input.nftData, nftEdition]
  );
  const txId = await client.executeBroadcast(
    programs.rafflePrivate,
    "unsafe_host_raffle",
    [
      raffleId,
      `${input.totalSlots}u64`,
      `${input.maxSlotsPerAddress || 0}u64`,
      metadataHash,
      prizeCommit,
      seedCommit,
      input.autoDraw ? "true" : "false",
      input.autoClaim ? "true" : "false"
    ],
    input.priorityFee || 0,
    input.privateFee || false
  );
  return { txId, raffleId, seedCommit, prizeCommit };
}
async function joinRaffleUnsafe(client, input) {
  const programs = getPrograms(input.programs);
  const raffleId = ensureFieldSuffix(input.raffleId);
  const slots = input.slots;
  if (!slots.length) throw new Error("slots is required");
  if (slots.length > 8) throw new Error("Max 8 slots per join");
  const microPerSlot = input.priceMicroPerSlot || Math.round((input.priceCreditsPerSlot ?? 1.5) * 1e6);
  const amountMicro = input.amountMicro ?? microPerSlot * slots.length;
  let paymentRecord = input.paymentRecord;
  if (!paymentRecord) {
    const found = await client.findCreditsRecord(amountMicro);
    paymentRecord = typeof found?.toString === "function" ? found.toString() : String(found);
  }
  const txId = await client.executeBroadcast(
    programs.rafflePrivate,
    "unsafe_join_raffle",
    [
      raffleId,
      formatU64Array(slots, 8),
      `${slots.length}u8`,
      paymentRecord,
      `${amountMicro}u64`
    ],
    input.priorityFee || 0,
    input.privateFee || false
  );
  return { txId, amountMicro, raffleId, slots };
}
async function drawRaffle(client, input) {
  const programs = getPrograms(input.programs);
  const raffleId = ensureFieldSuffix(input.raffleId);
  return client.executeBroadcast(
    programs.rafflePrivate,
    "draw_raffle",
    [raffleId, `${input.seed}u64`],
    input.priorityFee || 0,
    input.privateFee || false
  );
}
async function claimRafflePrize(client, input) {
  const programs = getPrograms(input.programs);
  const edition = ensureScalarSuffix(input.nftEdition || "1");
  return client.executeBroadcast(
    programs.rafflePrivate,
    "claim_prize",
    [input.ticketRecord, `${input.slotId}u64`, input.nftData, edition],
    input.priorityFee || 0,
    input.privateFee || false
  );
}

// src/modules/raffle.views.ts
async function getRaffleDetail(client, raffleIdInput, programs) {
  const ids = getPrograms(programs);
  const raffleId = ensureFieldSuffix(raffleIdInput);
  const raw = await client.getProgramMappingValue(
    ids.rafflePrivate,
    "raffles",
    raffleId
  );
  const fields = parseStructFields(raw);
  return {
    raffleId,
    raw,
    fields,
    status: raffleStatusLabel(fields.status)
  };
}
async function getRaffleSlots(client, raffleIdInput, totalSlotsInput, programs) {
  const ids = getPrograms(programs);
  const raffleId = ensureFieldSuffix(raffleIdInput);
  let totalSlots = totalSlotsInput || 0;
  if (!totalSlots) {
    const detail = await getRaffleDetail(client, raffleId, ids);
    totalSlots = Number((detail.fields.total_slots || "0u64").replace("u64", ""));
  }
  if (!totalSlots) throw new Error("Unable to determine total slots");
  const taken = [];
  const available = [];
  for (let slot = 1; slot <= totalSlots; slot += 1) {
    const [slotKey] = await client.executeOffline(
      ids.rafflePrivate,
      "compute_slot_key_hash",
      [raffleId, `${slot}u64`]
    );
    try {
      const value = await client.getProgramMappingValue(
        ids.rafflePrivate,
        "slot_taken",
        slotKey
      );
      if (value === "true") {
        taken.push(slot);
      } else {
        available.push(slot);
      }
    } catch {
      available.push(slot);
    }
  }
  return { raffleId, totalSlots, taken, available };
}
function extractField(raw, key) {
  const regex = new RegExp(`${key}\\s*:\\s*([^,}]+)`);
  const match = raw.match(regex);
  return match ? match[1].trim() : void 0;
}
function extractSlots(raw) {
  const match = raw.match(/slots\s*:\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1].split(",").map((v) => v.trim()).map((v) => Number(v.replace("u64", ""))).filter((v) => Number.isFinite(v) && v > 0);
}
async function getUserTickets(client, input = {}) {
  const ids = getPrograms(input.programs);
  const records = await client.findRecords(
    ids.rafflePrivate,
    "TicketBatch",
    input.maxRecords ?? 50,
    input.startHeight ?? 0,
    input.endHeight
  );
  const raffleIds = /* @__PURE__ */ new Set();
  const tickets = [];
  for (const record of records) {
    const raw = typeof record?.toString === "function" ? record.toString() : String(record);
    const raffleId = extractField(raw, "raffle_id");
    if (raffleId) raffleIds.add(raffleId);
    if (!input.raffleId || input.raffleId === raffleId) {
      tickets.push({
        raw,
        raffleId,
        slots: extractSlots(raw)
      });
    }
  }
  return {
    raffleIds: Array.from(raffleIds),
    tickets
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ALEO_CONFIG,
  AleoNFTClient,
  claimRafflePrize,
  createClient,
  drawRaffle,
  ensureFieldSuffix,
  ensureScalarSuffix,
  formatU64Array,
  getPrivateKey,
  getProgramPath,
  getPrograms,
  getRaffleDetail,
  getRaffleSlots,
  getUserTickets,
  hostRaffleUnsafe,
  initializeRafflePrivate,
  joinRaffleUnsafe,
  mintFaucet,
  mintPrivateViaGateway,
  parseStructFields,
  raffleStatusLabel
});
//# sourceMappingURL=index.cjs.map