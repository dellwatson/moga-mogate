import {
  CasperClient,
  CLPublicKey,
  CLValueBuilder,
  CLByteArray,
  DeployUtil,
  RuntimeArgs,
  Keys,
} from "casper-js-sdk";
import * as fs from "fs";
import { CASPER_TESTNET_RPC, CASPER_CHAIN_NAME } from "./casper-authority-mint";

// New RWA raffle contract (rwa_raffle_purse) deployed on Casper testnet
// Stored as plain 64-char hex (no "hash-" prefix)
export const RWA_RAFFLE_CONTRACT_HASH =
  "4f976c4db1f467ef765fc561dcf45e9354cbf6195fb64beeba37dfea84e9d8d2";

export interface HostRaffleParams {
  raffleId: string;
  totalSlots: number;
  maxSlotsPerAddress: number;
  pricePerSlot: string; // motes (U512 decimal string)
  metadataUri: string;
  collectionHash: string; // PUBLIC CEP-95 collection hash, 64-char hex without prefix
  premintContract: boolean;
  premint: boolean;
  autoClaim: boolean;
  expiresAt: string; // U512 decimal string (e.g. unix ms)
  paymentAmount?: string; // gas payment in motes (default 50 CSPR)
}

export interface JoinRafflePaidParams {
  raffleId: string;
  slotIds: number[];
  amount: string; // total CSPR to pay for slots, in motes (U512 decimal string)
  paymentAmount?: string; // gas payment in motes (default 50 CSPR)
}

export class CasperRwaRaffleClient {
  private client: CasperClient;
  private chainName: string;
  private raffleContractHashHex: string;

  constructor(
    nodeAddress: string = CASPER_TESTNET_RPC,
    chainName: string = CASPER_CHAIN_NAME,
    raffleContractHashHex: string = RWA_RAFFLE_CONTRACT_HASH
  ) {
    this.client = new CasperClient(nodeAddress);
    this.chainName = chainName;
    this.raffleContractHashHex = raffleContractHashHex;
  }

  private contractHashBytes(): Uint8Array {
    return Uint8Array.from(Buffer.from(this.raffleContractHashHex, "hex"));
  }

  /**
   * Build a deploy to host a raffle via unsafe_host_raffle.
   * Caller signs and sends this deploy.
   */
  buildHostRaffleDeploy(
    params: HostRaffleParams,
    publicKey: CLPublicKey
  ): DeployUtil.Deploy {
    const {
      raffleId,
      totalSlots,
      maxSlotsPerAddress,
      pricePerSlot,
      metadataUri,
      collectionHash,
      premintContract,
      premint,
      autoClaim,
      expiresAt,
      paymentAmount = "50000000000", // 50 CSPR default gas
    } = params;

    if (!/^[0-9a-fA-F]{64}$/.test(collectionHash)) {
      throw new Error(
        "collectionHash must be 64-char hex string without prefix"
      );
    }

    const collectionHashBytes = Uint8Array.from(
      Buffer.from(collectionHash, "hex")
    );

    const runtimeArgs = RuntimeArgs.fromMap({
      raffle_id: CLValueBuilder.string(raffleId),
      total_slots: CLValueBuilder.u64(totalSlots),
      max_slots_per_address: CLValueBuilder.u64(maxSlotsPerAddress),
      price_per_slot: CLValueBuilder.u512(pricePerSlot),
      metadata_uri: CLValueBuilder.string(metadataUri),
      collection_hash: new CLByteArray(collectionHashBytes),
      premint_contract: CLValueBuilder.bool(premintContract),
      premint: CLValueBuilder.bool(premint),
      auto_claim: CLValueBuilder.bool(autoClaim),
      expires_at: CLValueBuilder.u512(expiresAt),
    });

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      this.contractHashBytes(),
      "unsafe_host_raffle",
      runtimeArgs
    );

    return DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(publicKey, this.chainName),
      session,
      DeployUtil.standardPayment(paymentAmount)
    );
  }

  async hostRaffle(
    params: HostRaffleParams,
    signerKeys: Keys.AsymmetricKey
  ): Promise<string> {
    const deploy = this.buildHostRaffleDeploy(params, signerKeys.publicKey);
    const signed = deploy.sign([signerKeys]);
    return this.client.putDeploy(signed);
  }

  /**
   * Build a paid join deploy using precompiled session wasm bytes.
   * The session wasm implements:
   *   - create temp purse
   *   - main_purse -> temp purse (amount)
   *   - call join_raffle(raffle_id, slot_ids, source_purse = temp purse)
   */
  buildJoinRafflePaidDeployFromBytes(
    params: JoinRafflePaidParams,
    publicKey: CLPublicKey,
    sessionWasmBytes: Uint8Array
  ): DeployUtil.Deploy {
    const {
      raffleId,
      slotIds,
      amount,
      paymentAmount = "50000000000", // 50 CSPR gas
    } = params;

    const slotCl = slotIds.map((s) => CLValueBuilder.u64(s));

    const runtimeArgs = RuntimeArgs.fromMap({
      amount: CLValueBuilder.u512(amount),
      // session expects raffle_contract: ContractHash, encoded as ByteArray(32)
      raffle_contract: new CLByteArray(this.contractHashBytes()),
      raffle_id: CLValueBuilder.string(raffleId),
      slot_ids: CLValueBuilder.list(slotCl),
    });

    const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
      sessionWasmBytes,
      runtimeArgs
    );

    return DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(publicKey, this.chainName),
      session,
      DeployUtil.standardPayment(paymentAmount)
    );
  }

  /**
   * Convenience: read session wasm from disk (Node.js) and build paid join deploy.
   */
  buildJoinRafflePaidDeployFromFile(
    params: JoinRafflePaidParams,
    publicKey: CLPublicKey,
    sessionWasmPath: string
  ): DeployUtil.Deploy {
    const wasm = fs.readFileSync(sessionWasmPath);
    return this.buildJoinRafflePaidDeployFromBytes(
      params,
      publicKey,
      new Uint8Array(wasm)
    );
  }

  /**
   * High-level helper: run a full paid join (Node.js, signer keys, local wasm file).
   */
  async joinRafflePaidFromFile(
    params: JoinRafflePaidParams & { sessionWasmPath: string },
    signerKeys: Keys.AsymmetricKey
  ): Promise<string> {
    const deploy = this.buildJoinRafflePaidDeployFromFile(
      params,
      signerKeys.publicKey,
      params.sessionWasmPath
    );
    const signed = deploy.sign([signerKeys]);
    return this.client.putDeploy(signed);
  }

  async sendDeploy(signedDeploy: DeployUtil.Deploy): Promise<string> {
    return this.client.putDeploy(signedDeploy);
  }

  async waitForDeploy(
    deployHash: string,
    timeoutMs: number = 180000
  ): Promise<any> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const [deploy, raw] = await this.client.getDeploy(deployHash);
        const results = raw.execution_results;
        if (results && results.length > 0) {
          const result = results[0].result;
          if ((result as any).Success) {
            return { success: true, deploy, result };
          }
          if ((result as any).Failure) {
            return { success: false, deploy, error: (result as any).Failure };
          }
        }
      } catch {
        // ignore and keep polling
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error(`Deploy ${deployHash} timeout after ${timeoutMs}ms`);
  }
}
