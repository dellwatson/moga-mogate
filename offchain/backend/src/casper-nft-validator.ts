/**
 * Casper NFT Burn Validator
 *
 * Validates NFT burn transactions and extracts:
 * - Metadata URI
 * - Last owner address
 * - Collection info
 * - Token ID
 *
 * Given only a burn transaction hash, this service can verify the burn
 * and extract all relevant NFT data from the CEP-78 contract events.
 */

import { CasperClient, CLPublicKey } from "casper-js-sdk";

export interface BurnValidationResult {
  valid: boolean;
  error?: string;
  data?: {
    deployHash: string;
    blockHash: string;
    timestamp: string;
    burner: string; // Account hash of who burned the NFT
    collection: {
      contractHash: string;
      contractPackageHash: string;
      name?: string;
      symbol?: string;
    };
    nft: {
      tokenId: string;
      metadataUri: string;
      lastOwner: string; // Account hash of last owner before burn
      burnedAt: string;
    };
  };
}

export interface CEP78Event {
  name: string;
  data: any;
}

export class CasperNFTBurnValidator {
  private client: CasperClient;
  private chainName: string;

  constructor(nodeAddress: string, chainName: string = "casper-test") {
    this.client = new CasperClient(nodeAddress);
    this.chainName = chainName;
  }

  /**
   * Validate a burn transaction and extract NFT metadata + owner
   *
   * @param burnTxHash - The deploy hash of the burn transaction
   * @returns Validation result with NFT data
   *
   * @example
   * ```typescript
   * const validator = new CasperNFTBurnValidator('http://65.109.83.79:7777');
   * const result = await validator.validateBurn('abc123...');
   *
   * if (result.valid) {
   *   console.log('Metadata URI:', result.data.nft.metadataUri);
   *   console.log('Last Owner:', result.data.nft.lastOwner);
   * }
   * ```
   */
  async validateBurn(burnTxHash: string): Promise<BurnValidationResult> {
    try {
      // 1. Get deploy info
      const [deploy, rawDeploy] = await this.client.getDeploy(burnTxHash);

      if (!rawDeploy) {
        return {
          valid: false,
          error: "Deploy not found",
        };
      }

      // 2. Check execution results
      const executionResults = rawDeploy.execution_results;
      if (!executionResults || executionResults.length === 0) {
        return {
          valid: false,
          error: "Deploy not executed yet",
        };
      }

      const result = executionResults[0].result;
      if (!result.Success) {
        return {
          valid: false,
          error: `Deploy failed: ${
            result.Failure?.error_message || "Unknown error"
          }`,
        };
      }

      // 3. Extract session info
      const session = deploy.session;
      let contractHash: string | null = null;
      let entryPoint: string | null = null;

      if (session.StoredContractByHash) {
        contractHash = Buffer.from(session.StoredContractByHash.hash).toString(
          "hex"
        );
        entryPoint = session.StoredContractByHash.entry_point;
      } else if (session.StoredContractByName) {
        entryPoint = session.StoredContractByName.entry_point;
        // Need to resolve contract hash from name
      }

      // 4. Verify it's a burn transaction
      if (entryPoint !== "burn") {
        return {
          valid: false,
          error: `Not a burn transaction. Entry point: ${entryPoint}`,
        };
      }

      // 5. Extract burner (caller)
      const burnerPublicKey = deploy.header.account;
      const burnerAccountHash =
        CLPublicKey.fromHex(burnerPublicKey).toAccountHashStr();

      // 6. Parse events from transforms
      const transforms = result.Success.effect.transforms;
      const events = this.parseEventsFromTransforms(transforms);

      // 7. Find Burn event
      const burnEvent = events.find(
        (e) => e.name === "Burn" || e.name === "cep78_burn"
      );
      if (!burnEvent) {
        return {
          valid: false,
          error: "No burn event found in transaction",
        };
      }

      // 8. Extract token data from burn event
      const tokenId = this.extractTokenId(burnEvent, deploy);
      const lastOwner = this.extractLastOwner(burnEvent, burnerAccountHash);

      // 9. Query contract for metadata URI
      let metadataUri = "";
      try {
        if (contractHash) {
          metadataUri = await this.getTokenMetadata(contractHash, tokenId);
        }
      } catch (error) {
        console.warn("Could not fetch metadata URI:", error);
        // Try to extract from event data
        metadataUri =
          burnEvent.data?.token_uri || burnEvent.data?.metadata || "";
      }

      // 10. Get collection info
      const collectionInfo = await this.getCollectionInfo(contractHash || "");

      // 11. Return validated result
      return {
        valid: true,
        data: {
          deployHash: burnTxHash,
          blockHash: executionResults[0].block_hash,
          timestamp: deploy.header.timestamp,
          burner: burnerAccountHash,
          collection: {
            contractHash: contractHash || "",
            contractPackageHash: collectionInfo.packageHash || "",
            name: collectionInfo.name,
            symbol: collectionInfo.symbol,
          },
          nft: {
            tokenId,
            metadataUri,
            lastOwner,
            burnedAt: deploy.header.timestamp,
          },
        },
      };
    } catch (error: any) {
      return {
        valid: false,
        error: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Parse CEP-78 events from deploy transforms
   */
  private parseEventsFromTransforms(transforms: any[]): CEP78Event[] {
    const events: CEP78Event[] = [];

    for (const transform of transforms) {
      if (transform.transform === "WriteCLValue") {
        try {
          const clValue = transform.transform.WriteCLValue;
          // CEP-78 events are stored as CLValues with specific keys
          if (clValue && clValue.parsed) {
            const parsed = JSON.parse(clValue.parsed);
            if (parsed.event_type || parsed.name) {
              events.push({
                name: parsed.event_type || parsed.name,
                data: parsed,
              });
            }
          }
        } catch (e) {
          // Not an event, continue
        }
      }
    }

    return events;
  }

  /**
   * Extract token ID from burn event or deploy args
   */
  private extractTokenId(burnEvent: CEP78Event, deploy: any): string {
    // Try event data first
    if (burnEvent.data?.token_id !== undefined) {
      return burnEvent.data.token_id.toString();
    }

    // Try deploy session args
    const args =
      deploy.session?.StoredContractByHash?.args ||
      deploy.session?.StoredContractByName?.args ||
      [];

    for (const [key, value] of args) {
      if (key === "token_id") {
        return value.parsed || value.toString();
      }
    }

    return "unknown";
  }

  /**
   * Extract last owner from burn event
   * In CEP-78, the burner is usually the last owner
   */
  private extractLastOwner(
    burnEvent: CEP78Event,
    burnerAccountHash: string
  ): string {
    // Try event data
    if (burnEvent.data?.owner) {
      return burnEvent.data.owner;
    }

    // Default to burner (they must have owned it to burn it)
    return burnerAccountHash;
  }

  /**
   * Query CEP-78 contract for token metadata
   */
  private async getTokenMetadata(
    contractHash: string,
    tokenId: string
  ): Promise<string> {
    try {
      const stateRootHash = await this.client.nodeClient.getStateRootHash();

      // Query metadata dictionary
      const metadataResult =
        await this.client.nodeClient.getDictionaryItemByName(
          stateRootHash,
          `hash-${contractHash}`,
          "metadata",
          tokenId
        );

      if (metadataResult && metadataResult.CLValue) {
        const metadata = metadataResult.CLValue.data;
        // CEP-78 metadata is JSON string with token_uri
        if (typeof metadata === "string") {
          const parsed = JSON.parse(metadata);
          return parsed.token_uri || parsed.uri || "";
        }
      }

      return "";
    } catch (error) {
      console.warn("Failed to query metadata:", error);
      return "";
    }
  }

  /**
   * Get collection info (name, symbol, package hash)
   */
  private async getCollectionInfo(contractHash: string): Promise<{
    name?: string;
    symbol?: string;
    packageHash?: string;
  }> {
    try {
      const stateRootHash = await this.client.nodeClient.getStateRootHash();
      const contractData = await this.client.nodeClient.getBlockState(
        stateRootHash,
        `hash-${contractHash}`,
        []
      );

      const namedKeys = contractData.Contract?.named_keys || [];
      let name: string | undefined;
      let symbol: string | undefined;
      let packageHash: string | undefined;

      for (const namedKey of namedKeys) {
        if (namedKey.name === "collection_name") {
          name = namedKey.key; // Simplified - actual parsing needed
        }
        if (namedKey.name === "collection_symbol") {
          symbol = namedKey.key;
        }
        if (namedKey.name.includes("package_hash")) {
          packageHash = namedKey.key;
        }
      }

      return { name, symbol, packageHash };
    } catch (error) {
      console.warn("Failed to get collection info:", error);
      return {};
    }
  }

  /**
   * Batch validate multiple burn transactions
   */
  async validateBurns(burnTxHashes: string[]): Promise<BurnValidationResult[]> {
    return Promise.all(burnTxHashes.map((hash) => this.validateBurn(hash)));
  }

  /**
   * Check if a deploy is a burn transaction (without full validation)
   */
  async isBurnTransaction(deployHash: string): Promise<boolean> {
    try {
      const [deploy] = await this.client.getDeploy(deployHash);
      const session = deploy.session;

      let entryPoint: string | null = null;
      if (session.StoredContractByHash) {
        entryPoint = session.StoredContractByHash.entry_point;
      } else if (session.StoredContractByName) {
        entryPoint = session.StoredContractByName.entry_point;
      }

      return entryPoint === "burn";
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance for testnet
export const testnetBurnValidator = new CasperNFTBurnValidator(
  "http://65.109.83.79:7777",
  "casper-test"
);

// Export for mainnet
export const mainnetBurnValidator = new CasperNFTBurnValidator(
  "http://65.108.78.120:7777", // Mainnet peer
  "casper"
);
