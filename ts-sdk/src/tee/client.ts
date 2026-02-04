import { ethers } from "ethers";
import type { Contract, Provider, Signer } from "ethers";
import { RAFFLE_TEE_ABI } from "./abi.ts";

export enum PrivacyMode {
  SLOTS_ONLY = 0,
  FULL = 1,
}

export enum PrizeTokenType {
  NONE = 0,
  ERC721 = 1,
  ERC1155 = 2,
  ERC404 = 3,
}

export type TeeRaffleClientConfig = {
  rpcUrl: string;
  privateKey?: string;
  raffleAddress: string;
};

export type TeeRaffleClientFromSignerConfig = {
  signer: Signer;
  raffleAddress: string;
};

export type TeeRaffleClientFromProviderConfig = {
  provider: Provider;
  raffleAddress: string;
};

export type TeeRaffleClient = {
  provider: Provider;
  signer?: Signer;
  raffle: Contract;
};

export function getTeeRaffleContract(
  raffleAddress: string,
  signerOrProvider: Signer | Provider,
) {
  return new ethers.Contract(raffleAddress, RAFFLE_TEE_ABI, signerOrProvider);
}

export function createTeeRaffleClient(
  config: TeeRaffleClientConfig,
): TeeRaffleClient {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = config.privateKey
    ? new ethers.Wallet(config.privateKey, provider)
    : undefined;
  const raffle = getTeeRaffleContract(config.raffleAddress, signer ?? provider);
  return { provider, signer, raffle };
}

export function createTeeRaffleClientFromSigner(
  config: TeeRaffleClientFromSignerConfig,
): TeeRaffleClient {
  const provider = config.signer.provider;
  if (!provider) {
    throw new Error("Signer must be connected to a provider");
  }
  const raffle = getTeeRaffleContract(config.raffleAddress, config.signer);
  return { provider, signer: config.signer, raffle };
}

export function createTeeRaffleClientFromProvider(
  config: TeeRaffleClientFromProviderConfig,
): TeeRaffleClient {
  const raffle = getTeeRaffleContract(config.raffleAddress, config.provider);
  return { provider: config.provider, raffle };
}

export function buildSlotCommitment(params: {
  raffleId: string;
  slotId: bigint;
  salt: string;
  buyer: string;
}) {
  const raffleIdHash = ethers.id(params.raffleId);
  return ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint256", "bytes32", "address"],
      [raffleIdHash, params.slotId, params.salt, params.buyer],
    ),
  );
}
