// src/client.ts
import * as AleoSDK from "@provablehq/sdk";

// src/config.ts
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
config({ path: join(__dirname, "../../.env") });
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
export {
  ALEO_CONFIG,
  AleoNFTClient,
  createClient,
  getPrivateKey,
  getProgramPath
};
//# sourceMappingURL=index.js.map