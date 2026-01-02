/**
 * Casper Authority Mint SDK
 *
 * SDK for interacting with the authority_mint contract on Casper testnet.
 * Uses casper-js-sdk (NOT cspr.click - that's for wallet integration).
 */

import {
  CasperClient,
  CLPublicKey,
  CLValueBuilder,
  CLByteArray,
  DeployUtil,
  RuntimeArgs,
  Keys,
} from "casper-js-sdk";

// Deployed contract addresses on Casper testnet
export const CASPER_TESTNET_RPC = "http://65.109.83.79:7777";
export const CASPER_CHAIN_NAME = "casper-test";

export const AUTHORITY_MINT_CONTRACT_HASH =
  "b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc";
export const AUTHORITY_MINT_PACKAGE_HASH =
  "a24eaa7fb04639155832147ee177ca4088dc4b5658265d5bc203e02810e93475";

// Collection contract hashes (without 'contract-' prefix)
export const TIXIA_1O1_COLLECTION_HASH =
  "376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97";
export const TIXIA_SFT_COLLECTION_HASH =
  "e3699ea7bbbcc74018b0c24d3557c6cfd34b9c30405cf4cf4bae3dfc589ccea0";

export interface NFTMetadata {
  name: string;
  token_uri: string;
}

export interface MintNFTParams {
  collectionHash: string; // 64-char hex string (no 'contract-' prefix)
  recipientAccountHash: string; // 64-char hex string (no 'account-hash-' prefix)
  metadata: NFTMetadata;
  paymentAmount?: string; // motes, default 5_000_000_000 (5 CSPR)
}

export class CasperAuthorityMintClient {
  private client: CasperClient;
  private chainName: string;

  constructor(
    nodeAddress: string = CASPER_TESTNET_RPC,
    chainName: string = CASPER_CHAIN_NAME
  ) {
    this.client = new CasperClient(nodeAddress);
    this.chainName = chainName;
  }

  /**
   * Mint an NFT via the authority_mint contract
   *
   * @param params - Minting parameters
   * @param signerKeys - Signer's key pair (public + private key)
   * @returns Deploy hash
   *
   * @example
   * ```typescript
   * const client = new CasperAuthorityMintClient();
   * const keys = Keys.Ed25519.parseKeyFiles(
   *   './public_key.pem',
   *   './secret_key.pem'
   * );
   *
   * const deployHash = await client.mintNFT({
   *   collectionHash: TIXIA_1O1_COLLECTION_HASH,
   *   recipientAccountHash: '1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8',
   *   metadata: {
   *     name: 'Tixia $100 Flight Credit',
   *     token_uri: 'https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/100/metadata.json'
   *   }
   * }, keys);
   * ```
   */
  async mintNFT(
    params: MintNFTParams,
    signerKeys: Keys.AsymmetricKey
  ): Promise<string> {
    const {
      collectionHash,
      recipientAccountHash,
      metadata,
      paymentAmount = "5000000000", // 5 CSPR default
    } = params;

    // Validate hex strings
    if (!/^[0-9a-fA-F]{64}$/.test(collectionHash)) {
      throw new Error(
        "collectionHash must be 64-char hex string without prefix"
      );
    }
    if (!/^[0-9a-fA-F]{64}$/.test(recipientAccountHash)) {
      throw new Error(
        "recipientAccountHash must be 64-char hex string without prefix"
      );
    }

    // Build runtime arguments
    const runtimeArgs = RuntimeArgs.fromMap({
      collection_hash: new CLByteArray(
        Uint8Array.from(Buffer.from(collectionHash, "hex"))
      ),
      token_owner: CLValueBuilder.key(
        CLValueBuilder.byteArray(
          Uint8Array.from(Buffer.from(recipientAccountHash, "hex"))
        )
      ),
      token_meta_data: CLValueBuilder.string(JSON.stringify(metadata)),
    });

    // Build deploy
    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        signerKeys.publicKey,
        this.chainName,
        1, // gas price
        1800000 // ttl (30 minutes)
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(AUTHORITY_MINT_CONTRACT_HASH, "hex")),
        "mint_nft",
        runtimeArgs
      ),
      DeployUtil.standardPayment(paymentAmount)
    );

    // Sign deploy
    const signedDeploy = deploy.sign([signerKeys]);

    // Send deploy
    const deployHash = await this.client.putDeploy(signedDeploy);

    return deployHash;
  }

  /**
   * Mint NFT using wallet signature (for frontend integration with Casper Wallet/Signer)
   *
   * @param params - Minting parameters
   * @param publicKey - User's public key (from wallet)
   * @returns Unsigned deploy (to be signed by wallet)
   *
   * @example
   * ```typescript
   * // Frontend with Casper Wallet
   * const client = new CasperAuthorityMintClient();
   * const publicKey = CLPublicKey.fromHex(userPublicKeyHex);
   *
   * const deploy = client.buildMintNFTDeploy({
   *   collectionHash: TIXIA_1O1_COLLECTION_HASH,
   *   recipientAccountHash: userAccountHash,
   *   metadata: { name: 'NFT', token_uri: 'https://...' }
   * }, publicKey);
   *
   * // Sign with wallet
   * const signedDeploy = await window.casperlabsHelper.sign(deploy, publicKey);
   * const deployHash = await client.sendDeploy(signedDeploy);
   * ```
   */
  buildMintNFTDeploy(
    params: MintNFTParams,
    publicKey: CLPublicKey
  ): DeployUtil.Deploy {
    const {
      collectionHash,
      recipientAccountHash,
      metadata,
      paymentAmount = "5000000000",
    } = params;

    const runtimeArgs = RuntimeArgs.fromMap({
      collection_hash: new CLByteArray(
        Uint8Array.from(Buffer.from(collectionHash, "hex"))
      ),
      token_owner: CLValueBuilder.key(
        CLValueBuilder.byteArray(
          Uint8Array.from(Buffer.from(recipientAccountHash, "hex"))
        )
      ),
      token_meta_data: CLValueBuilder.string(JSON.stringify(metadata)),
    });

    return DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(publicKey, this.chainName, 1, 1800000),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(AUTHORITY_MINT_CONTRACT_HASH, "hex")),
        "mint_nft",
        runtimeArgs
      ),
      DeployUtil.standardPayment(paymentAmount)
    );
  }

  /**
   * Send a signed deploy
   */
  async sendDeploy(signedDeploy: DeployUtil.Deploy): Promise<string> {
    return await this.client.putDeploy(signedDeploy);
  }

  /**
   * Get deploy status
   */
  async getDeployStatus(deployHash: string): Promise<any> {
    return await this.client.getDeploy(deployHash);
  }

  /**
   * Wait for deploy to be executed
   */
  async waitForDeploy(
    deployHash: string,
    timeoutMs: number = 180000
  ): Promise<any> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const [deploy, raw] = await this.client.getDeploy(deployHash);
        if (raw.execution_results && raw.execution_results.length > 0) {
          const result = raw.execution_results[0].result;
          if (result.Success) {
            return { success: true, deploy, result };
          } else if (result.Failure) {
            return { success: false, deploy, error: result.Failure };
          }
        }
      } catch (error) {
        // Deploy not found yet, continue waiting
      }
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5s
    }
    throw new Error(`Deploy ${deployHash} timeout after ${timeoutMs}ms`);
  }

  /**
   * Get mint count from authority_mint contract
   */
  async getMintCount(): Promise<number> {
    // Query contract state
    const stateRootHash = await this.client.nodeClient.getStateRootHash();
    const contractData = await this.client.nodeClient.getBlockState(
      stateRootHash,
      `hash-${AUTHORITY_MINT_CONTRACT_HASH}`,
      []
    );

    // Parse mint_counter from stored value
    // Note: This requires the contract to expose mint_counter as a named key
    // For now, return 0 as placeholder
    return 0;
  }
}

// Helper function to convert account hash with prefix to raw hex
export function stripAccountHashPrefix(accountHash: string): string {
  if (accountHash.startsWith("account-hash-")) {
    return accountHash.replace("account-hash-", "");
  }
  return accountHash;
}

// Helper function to convert contract hash with prefix to raw hex
export function stripContractHashPrefix(contractHash: string): string {
  if (contractHash.startsWith("contract-")) {
    return contractHash.replace("contract-", "");
  }
  return contractHash;
}

// Export for convenience
export { CLPublicKey, Keys } from "casper-js-sdk";
