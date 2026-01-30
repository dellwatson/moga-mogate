// Aleo SDK Client Wrapper
import {
  Account,
  ProgramManager,
  AleoNetworkClient,
  NetworkRecordProvider,
  AleoKeyProvider,
} from "@provablehq/sdk";
import { ALEO_CONFIG, getPrivateKey } from "./config.js";

export class AleoNFTClient {
  private account: Account;
  private networkClient: AleoNetworkClient;
  private programManager: ProgramManager;
  private keyProvider: AleoKeyProvider;
  private recordProvider: NetworkRecordProvider;

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

  // Execute a transition (local, no broadcast)
  async execute(
    programName: string,
    functionName: string,
    inputs: string[],
    fee: number = 0,
  ): Promise<string> {
    try {
      const result = await this.programManager.execute(
        programName,
        functionName,
        fee,
        false, // Not offline
        inputs,
      );
      return result;
    } catch (error) {
      console.error(`Error executing ${programName}/${functionName}:`, error);
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

  // Mint NFT through authority gateway (owner only)
  async mintAuthority(
    toAddress: string,
    uriHash: string,
    tokenId: string,
  ): Promise<string> {
    const programName = ALEO_CONFIG.programs.gateway.v2;
    return this.execute(programName, "mint", [toAddress, uriHash, tokenId]);
  }

  // Mint NFT through faucet (public)
  async mintFaucet(toAddress: string, uriHash: string): Promise<string> {
    const programName = ALEO_CONFIG.programs.gateway.v2;
    return this.execute(programName, "mint_nft", [toAddress, uriHash]);
  }

  // Mint NFT directly from collection (public, bypasses gateway)
  async mintDirect(toAddress: string, uriHash: string): Promise<string> {
    const programName = ALEO_CONFIG.programs.collection.v2;
    return this.execute(programName, "mint_to", [toAddress, uriHash]);
  }

  // Initialize gateway with owner
  async initializeGateway(ownerAddress: string): Promise<string> {
    const programName = ALEO_CONFIG.programs.gateway.v2;
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
}

// Export singleton instance
export function createClient(privateKey?: string): AleoNFTClient {
  return new AleoNFTClient(privateKey);
}
