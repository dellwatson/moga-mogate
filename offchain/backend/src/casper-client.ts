import {
  CasperClient,
  CLPublicKey,
  DeployUtil,
  RuntimeArgs,
  CLValueBuilder,
} from "casper-js-sdk";
import * as fs from "fs";
import * as path from "path";

/**
 * Casper client configuration for backend usage
 * Supports both cspr.cloud (with API key) and direct peer nodes
 */

export interface CasperConfig {
  network: "mainnet" | "testnet";
  useCloud?: boolean; // Use cspr.cloud vs direct peer
  cloudApiKey?: string;
  peerNodeUrl?: string;
}

export class CasperBackendClient {
  private client: CasperClient;
  private config: CasperConfig;

  constructor(config: CasperConfig) {
    this.config = config;

    if (config.useCloud && config.cloudApiKey) {
      // Use cspr.cloud with API key
      const cloudUrl =
        config.network === "mainnet"
          ? "https://node.mainnet.cspr.cloud"
          : "https://node.testnet.cspr.cloud";

      this.client = new CasperClient(cloudUrl);
      // Note: casper-js-sdk doesn't natively support API key auth in headers
      // You'd need to use fetch/axios directly for authenticated requests
      console.log(
        `Using cspr.cloud (${config.network}) - API key auth required for some endpoints`
      );
    } else if (config.peerNodeUrl) {
      // Use direct peer node
      this.client = new CasperClient(config.peerNodeUrl);
      console.log(`Using direct peer: ${config.peerNodeUrl}`);
    } else {
      throw new Error("Must provide either cloudApiKey or peerNodeUrl");
    }
  }

  /**
   * Get account info by public key
   */
  async getAccountInfo(publicKeyHex: string): Promise<any> {
    const publicKey = CLPublicKey.fromHex(publicKeyHex);
    const stateRootHash = await this.client.nodeClient.getStateRootHash();
    return this.client.nodeClient.getBlockState(
      stateRootHash,
      publicKey.toAccountHashStr(),
      []
    );
  }

  /**
   * Get contract data by contract hash
   */
  async getContractData(contractHash: string): Promise<any> {
    const stateRootHash = await this.client.nodeClient.getStateRootHash();
    return this.client.nodeClient.getBlockState(
      stateRootHash,
      contractHash,
      []
    );
  }

  /**
   * Query CEP-18 token balance
   */
  async getCEP18Balance(
    contractHash: string,
    ownerPublicKeyHex: string
  ): Promise<string> {
    const ownerKey = CLPublicKey.fromHex(ownerPublicKeyHex);
    const stateRootHash = await this.client.nodeClient.getStateRootHash();

    // Query the balances dictionary
    const balanceUref = await this.client.nodeClient.getDictionaryItemByName(
      stateRootHash,
      contractHash,
      "balances",
      ownerKey.toAccountHashStr()
    );

    return balanceUref.CLValue?.data || "0";
  }

  /**
   * Deploy a contract (requires private key PEM)
   */
  async deployContract(
    pemFilePath: string,
    wasmPath: string,
    args: RuntimeArgs,
    paymentAmount: string
  ): Promise<string> {
    const privateKeyPem = fs.readFileSync(pemFilePath, "utf8");
    const keyPair = this.loadKeyPairFromPem(privateKeyPem);

    const deployParams = new DeployUtil.DeployParams(
      keyPair.publicKey,
      this.config.network === "mainnet" ? "casper" : "casper-test"
    );

    const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
    const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
      wasmBytes,
      args
    );
    const payment = DeployUtil.standardPayment(paymentAmount);

    const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
    const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

    const deployHash = await this.client.putDeploy(signedDeploy);
    return deployHash;
  }

  /**
   * Call a contract entry point
   */
  async callContract(
    pemFilePath: string,
    contractHash: string,
    entryPoint: string,
    args: RuntimeArgs,
    paymentAmount: string
  ): Promise<string> {
    const privateKeyPem = fs.readFileSync(pemFilePath, "utf8");
    const keyPair = this.loadKeyPairFromPem(privateKeyPem);

    const deployParams = new DeployUtil.DeployParams(
      keyPair.publicKey,
      this.config.network === "mainnet" ? "casper" : "casper-test"
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Uint8Array.from(Buffer.from(contractHash.replace("hash-", ""), "hex")),
      entryPoint,
      args
    );
    const payment = DeployUtil.standardPayment(paymentAmount);

    const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
    const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

    const deployHash = await this.client.putDeploy(signedDeploy);
    return deployHash;
  }

  /**
   * Get deploy status
   */
  async getDeployStatus(deployHash: string): Promise<any> {
    return this.client.nodeClient.getDeployInfo(deployHash);
  }

  /**
   * Helper: Load key pair from PEM string
   */
  private loadKeyPairFromPem(pemContent: string): any {
    // casper-js-sdk expects specific PEM format
    // For secp256k1 keys, you may need to use Keys.Secp256K1.parsePrivateKey
    // This is a simplified version - adjust based on your key type
    const privateKeyHex = pemContent
      .replace(/-----BEGIN EC PRIVATE KEY-----/g, "")
      .replace(/-----END EC PRIVATE KEY-----/g, "")
      .replace(/\s/g, "");

    // Parse based on key algorithm (ED25519 or Secp256K1)
    // This example assumes Secp256K1 (your Account 1 key)
    const { Keys } = require("casper-js-sdk");
    return Keys.Secp256K1.parsePrivateKey(
      Uint8Array.from(Buffer.from(privateKeyHex, "base64"))
    );
  }
}

// Example usage
export const casperCloudClient = new CasperBackendClient({
  network: "testnet",
  useCloud: true,
  cloudApiKey: process.env.VITE_CSPR_CLOUD_KEY,
});

export const casperPeerClient = new CasperBackendClient({
  network: "testnet",
  peerNodeUrl: "http://65.109.83.79:7777",
});
