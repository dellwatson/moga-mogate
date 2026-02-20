// Aleo SDK Client Wrapper
import * as AleoSDK from "@provablehq/sdk";
import { ALEO_CONFIG, getPrivateKey } from "./config.js";

const {
  Account,
  ProgramManager,
  ProgramManagerBase,
  AleoNetworkClient,
  NetworkRecordProvider,
  AleoKeyProvider,
} = AleoSDK as any;

export class AleoNFTClient {
  private account: any;
  private networkClient: any;
  private programManager: any;
  private keyProvider: any;
  private recordProvider: any;

  constructor(privateKey?: string) {
    // Initialize account
    const key = privateKey || getPrivateKey();
    this.account = new Account({ privateKey: key });

    // Initialize network client
    this.networkClient = new AleoNetworkClient(ALEO_CONFIG.endpoint);

    // Initialize key provider
    this.keyProvider = new AleoKeyProvider();
    this.keyProvider.useCache(true);

    // Initialize record provider
    this.recordProvider = new NetworkRecordProvider(
      this.account,
      this.networkClient,
    );

    // Initialize program manager
    this.programManager = new ProgramManager(
      ALEO_CONFIG.endpoint,
      this.keyProvider,
      this.recordProvider,
    );

    this.programManager.setAccount(this.account);
  }

  // Get account address
  getAddress(): string {
    return this.account.address().to_string();
  }

  // Get account balance
  async getBalance(): Promise<number> {
    try {
      const balance = await this.networkClient.getBalance(this.getAddress());
      return parseFloat(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      return 0;
    }
  }

  // Execute a transition (local, not broadcast)
  async execute(
    programName: string,
    functionName: string,
    inputs: string[],
    fee: number = 0,
  ): Promise<string> {
    try {
      console.log("DEBUG: Executing with inputs:", inputs);

      // Try building transaction first to see if it works better
      const transaction = await this.programManager.buildExecutionTransaction({
        programName,
        functionName,
        fee,
        privateFee: false,
        inputs,
      });

      console.log("DEBUG: Transaction built successfully:", transaction);
      return transaction.toString();
    } catch (error) {
      console.error(`Error executing ${programName}/${functionName}:`, error);
      throw error;
    }
  }

  // Execute and broadcast a transition
  async executeBroadcast(
    programName: string,
    functionName: string,
    inputs: string[],
    priorityFee: number = 0,
    privateFee: boolean = false,
  ): Promise<string> {
    try {
      const txId = await this.programManager.execute({
        programName,
        functionName,
        inputs,
        priorityFee,
        privateFee,
      });
      return txId;
    } catch (error) {
      console.error(`Error broadcasting ${programName}/${functionName}:`, error);
      throw error;
    }
  }

  // Execute a transition offline and return its outputs (no broadcast)
  async executeOffline(
    programName: string,
    functionName: string,
    inputs: string[],
  ): Promise<string[]> {
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
        imports,
      );
      const outputs = executionResponse.getOutputs();
      return outputs.map((output: any) =>
        typeof output?.toString === "function" ? output.toString() : String(output),
      );
    } catch (error) {
      console.error(
        `Error executing offline ${programName}/${functionName}:`,
        error,
      );
      throw error;
    }
  }

  // Deploy a program
  async deploy(programPath: string, fee: number = 10): Promise<string> {
    try {
      const txId = await this.programManager.deploy(
        programPath,
        fee,
        false, // Not offline
      );
      return txId;
    } catch (error) {
      console.error("Error deploying program:", error);
      throw error;
    }
  }

  async getProgramMappingValue(
    programName: string,
    mappingName: string,
    key: string,
  ): Promise<string> {
    const encodedKey = encodeURIComponent(key);
    return this.networkClient.getProgramMappingValue(
      programName,
      mappingName,
      encodedKey,
    );
  }

  async getProgramSource(programName: string): Promise<string> {
    return this.networkClient.getProgram(programName);
  }

  async getProgramImports(programName: string): Promise<any> {
    return this.networkClient.getProgramImports(programName);
  }

  async findCreditsRecord(microcredits: number): Promise<any> {
    return this.recordProvider.findCreditsRecord(microcredits, true, []);
  }

  // Mint NFT through authority gateway (owner only)
  async mintAuthority(
    toAddress: string,
    uriHash: string,
    tokenId: string,
  ): Promise<string> {
    const programName = ALEO_CONFIG.programs.gatewayLegacy.v2;
    // Format inputs with type annotations for SDK 0.9.9
    const inputs = [`${toAddress}`, `${uriHash}field`, `${tokenId}u64`];
    return this.execute(programName, "mint", inputs);
  }

  // Mint NFT through faucet (public)
  async mintFaucet(toAddress: string, uriHash: string): Promise<string> {
    const programName = ALEO_CONFIG.programs.gatewayLegacy.v2;
    return this.execute(programName, "mint_nft", [toAddress, uriHash]);
  }

  // Mint NFT directly from collection (public, bypasses gateway)
  async mintDirect(toAddress: string, uriHash: string): Promise<string> {
    const programName = ALEO_CONFIG.programs.collection.v2;
    return this.execute(programName, "mint_to", [toAddress, uriHash]);
  }

  // Initialize gateway with owner
  async initializeGateway(ownerAddress: string): Promise<string> {
    const programName = ALEO_CONFIG.programs.gatewayLegacy.v2;
    return this.execute(programName, "initialize", [ownerAddress]);
  }

  // Get transaction status
  async getTransaction(txId: string): Promise<any> {
    try {
      return await this.networkClient.getTransaction(txId);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      return null;
    }
  }

  // Find records for a given program + record name (owned by this account)
  async findRecords(
    programName: string,
    recordName: string,
    maxRecords: number = 20,
    startHeight: number = 0,
    endHeight?: number,
  ): Promise<any[]> {
    const params: any = {
      programName,
      recordName,
      maxRecords,
      startHeight,
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
}

// Export singleton instance
export function createClient(privateKey?: string): AleoNFTClient {
  return new AleoNFTClient(privateKey);
}
