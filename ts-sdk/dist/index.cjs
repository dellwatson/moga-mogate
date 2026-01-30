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
  createClient: () => createClient,
  getPrivateKey: () => getPrivateKey,
  getProgramPath: () => getProgramPath
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
    collection: {
      v1: "mogate_nft_collection_rwa.aleo",
      v2: "mogate_nft_collection_rwa_v2.aleo"
    },
    gateway: {
      v1: "mogate_authority_mint_gateway.aleo",
      v2: "mogate_authority_mint_v2.aleo"
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
  return program === "collection" ? `${base}/programs/collection` : `${base}/programs/authority_mint_gateway`;
}

// src/client.ts
var {
  Account,
  ProgramManager,
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
      const result = await this.programManager.execute({
        programName,
        functionName,
        fee,
        privateFee: false,
        inputs
      });
      return result;
    } catch (error) {
      console.error(`Error executing ${programName}/${functionName}:`, error);
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
  // Mint NFT through authority gateway (owner only)
  async mintAuthority(toAddress, uriHash, tokenId) {
    const programName = ALEO_CONFIG.programs.gateway.v2;
    const inputs = [`${toAddress}`, `${uriHash}field`, `${tokenId}u64`];
    return this.execute(programName, "mint", inputs);
  }
  // Mint NFT through faucet (public)
  async mintFaucet(toAddress, uriHash) {
    const programName = ALEO_CONFIG.programs.gateway.v2;
    return this.execute(programName, "mint_nft", [toAddress, uriHash]);
  }
  // Mint NFT directly from collection (public, bypasses gateway)
  async mintDirect(toAddress, uriHash) {
    const programName = ALEO_CONFIG.programs.collection.v2;
    return this.execute(programName, "mint_to", [toAddress, uriHash]);
  }
  // Initialize gateway with owner
  async initializeGateway(ownerAddress) {
    const programName = ALEO_CONFIG.programs.gateway.v2;
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
};
function createClient(privateKey) {
  return new AleoNFTClient(privateKey);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ALEO_CONFIG,
  AleoNFTClient,
  createClient,
  getPrivateKey,
  getProgramPath
});
//# sourceMappingURL=index.cjs.map