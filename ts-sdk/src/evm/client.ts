import { ethers } from "ethers";
import type { Contract, Provider, Signer } from "ethers";
import { RAFFLE_ABI } from "./abi.ts";

export enum PrizeTokenType {
  NONE = 0,
  ERC721 = 1,
  ERC1155 = 2,
  ERC404 = 3,
}

export const RAFFLE_EIP712_DOMAIN = {
  name: "MogateRaffle",
  version: "1",
} as const;

export type RaffleEip712Domain = {
  name: string;
  version: string;
  chainId: bigint;
  verifyingContract: string;
};

export const HOST_RAFFLE_TYPES = {
  HostRaffle: [
    { name: "raffleId", type: "string" },
    { name: "totalSlots", type: "uint256" },
    { name: "maxSlotsPerAddress", type: "uint256" },
    { name: "metadataUri", type: "string" },
    { name: "collection", type: "address" },
    { name: "premintContract", type: "bool" },
    { name: "premint", type: "bool" },
    { name: "prizeType", type: "uint8" },
    { name: "prizeAmount", type: "uint256" },
    { name: "autoDraw", type: "bool" },
    { name: "autoClaim", type: "bool" },
    { name: "expiresAt", type: "uint64" },
    { name: "organizer", type: "address" },
  ],
} as const;

export const JOIN_RAFFLE_TYPES = {
  JoinRaffle: [
    { name: "raffleId", type: "string" },
    { name: "slotIds", type: "uint256[]" },
    { name: "amount", type: "uint256" },
    { name: "token", type: "address" },
    { name: "payer", type: "address" },
  ],
} as const;

export const HOST_AND_JOIN_RAFFLE_TYPES = {
  HostAndJoinRaffle: [
    { name: "raffleId", type: "string" },
    { name: "totalSlots", type: "uint256" },
    { name: "maxSlotsPerAddress", type: "uint256" },
    { name: "metadataUri", type: "string" },
    { name: "collection", type: "address" },
    { name: "premintContract", type: "bool" },
    { name: "premint", type: "bool" },
    { name: "prizeType", type: "uint8" },
    { name: "prizeAmount", type: "uint256" },
    { name: "autoDraw", type: "bool" },
    { name: "autoClaim", type: "bool" },
    { name: "expiresAt", type: "uint64" },
    { name: "slotIds", type: "uint256[]" },
    { name: "amount", type: "uint256" },
    { name: "token", type: "address" },
    { name: "bonusFreeSlots", type: "uint256" },
    { name: "payer", type: "address" },
  ],
} as const;

export type RaffleClientConfig = {
  rpcUrl: string;
  privateKey?: string;
  raffleAddress: string;
};

export type RaffleClientFromSignerConfig = {
  signer: Signer;
  raffleAddress: string;
};

export type RaffleClientFromProviderConfig = {
  provider: Provider;
  raffleAddress: string;
};

export type RaffleClient = {
  provider: Provider;
  signer?: Signer;
  raffle: Contract;
};

export function getRaffleContract(
  raffleAddress: string,
  signerOrProvider: Signer | Provider,
) {
  return new ethers.Contract(raffleAddress, RAFFLE_ABI, signerOrProvider);
}

export function createRaffleClient(config: RaffleClientConfig): RaffleClient {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = config.privateKey
    ? new ethers.Wallet(config.privateKey, provider)
    : undefined;
  const raffle = getRaffleContract(config.raffleAddress, signer ?? provider);
  return { provider, signer, raffle };
}

export function createRaffleClientFromSigner(
  config: RaffleClientFromSignerConfig,
): RaffleClient {
  const provider = config.signer.provider;
  if (!provider) {
    throw new Error("Signer must be connected to a provider");
  }
  const raffle = getRaffleContract(config.raffleAddress, config.signer);
  return { provider, signer: config.signer, raffle };
}

export function createRaffleClientFromProvider(
  config: RaffleClientFromProviderConfig,
): RaffleClient {
  const raffle = getRaffleContract(config.raffleAddress, config.provider);
  return { provider: config.provider, raffle };
}

export type UnsafeHostRaffleParams = {
  raffleId: string;
  totalSlots: bigint;
  maxSlotsPerAddress: bigint;
  metadataUri: string;
  collection: string;
  premintContract: boolean;
  premint: boolean;
  prizeType: PrizeTokenType;
  prizeAmount: bigint;
  autoDraw: boolean;
  autoClaim: boolean;
  expiresAt: bigint;
};

export type UnsafeJoinRaffleParams = {
  raffleId: string;
  slotIds: bigint[];
  amount: bigint;
  token: string;
};

export type SafeHostRaffleParams = UnsafeHostRaffleParams;

export type SafeJoinRaffleParams = UnsafeJoinRaffleParams;

export type SafeHostAndJoinRaffleParams = SafeHostRaffleParams & {
  slotIds: bigint[];
  amount: bigint;
  token: string;
  bonusFreeSlots: bigint;
};

export type HostRafflePermit = SafeHostRaffleParams & {
  organizer: string;
};

export type JoinRafflePermit = SafeJoinRaffleParams & {
  payer: string;
};

export type HostAndJoinRafflePermit = SafeHostAndJoinRaffleParams & {
  payer: string;
};

export async function unsafeHostRaffleWithReport(
  client: RaffleClient,
  params: UnsafeHostRaffleParams,
) {
  if (!client.signer) {
    throw new Error("unsafeHostRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.unsafeHostRaffle(
    params.raffleId,
    params.totalSlots,
    params.maxSlotsPerAddress,
    params.metadataUri,
    params.collection,
    params.premintContract,
    params.premint,
    params.prizeType,
    params.prizeAmount,
    params.autoDraw,
    params.autoClaim,
    params.expiresAt,
  );
  const receipt = await tx.wait();

  const id = ethers.id(params.raffleId);

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  const loadReport = {
    totalSlots: load[0].toString(),
    soldSlots: load[1].toString(),
    maxSlotsPerAddress: load[2].toString(),
    metadataUri: load[3],
    collection: load[4],
    premintContract: load[5],
    premint: load[6],
    autoDraw: load[7],
    autoClaim: load[8],
    createdAt: Number(load[9]),
    expiresAt: Number(load[10]),
    status: load[11],
    statusString: load[12],
    winnerSlot: load[13].toString(),
    winner: load[14],
    prizeAmount: load[15].toString(),
    prizeType: load[16],
    prizeTypeString: load[17],
    claimed: load[18],
  };

  const resultReport = {
    winnerSlot: result[0].toString(),
    winner: result[1],
    status: result[2],
    statusString: result[3],
    claimed: result[4],
    collection: result[5],
    prizeAmount: result[6].toString(),
    prizeType: result[7],
    prizeTypeString: result[8],
  };

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    raffleBytesId: id,
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    load: loadReport,
    result: resultReport,
  };
}

export async function unsafeJoinRaffleWithReport(
  client: RaffleClient,
  params: UnsafeJoinRaffleParams,
  valueOverride?: bigint,
) {
  if (!client.signer) {
    throw new Error("unsafeJoinRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.unsafeJoinRaffle(
    params.raffleId,
    params.slotIds,
    params.amount,
    params.token,
    { value: valueOverride ?? params.amount },
  );
  const receipt = await tx.wait();

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  const loadReport = {
    totalSlots: load[0].toString(),
    soldSlots: load[1].toString(),
    maxSlotsPerAddress: load[2].toString(),
    metadataUri: load[3],
    collection: load[4],
    premintContract: load[5],
    premint: load[6],
    autoDraw: load[7],
    autoClaim: load[8],
    createdAt: Number(load[9]),
    expiresAt: Number(load[10]),
    status: load[11],
    statusString: load[12],
    winnerSlot: load[13].toString(),
    winner: load[14],
    prizeAmount: load[15].toString(),
    prizeType: load[16],
    prizeTypeString: load[17],
    claimed: load[18],
  };

  const resultReport = {
    winnerSlot: result[0].toString(),
    winner: result[1],
    status: result[2],
    statusString: result[3],
    claimed: result[4],
    collection: result[5],
    prizeAmount: result[6].toString(),
    prizeType: result[7],
    prizeTypeString: result[8],
  };

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    slotIds: params.slotIds.map((s) => s.toString()),
    paidAmountWei: params.amount.toString(),
    load: loadReport,
    result: resultReport,
  };
}

export function buildRaffleDomain(
  chainId: bigint,
  verifyingContract: string,
): RaffleEip712Domain {
  return {
    name: RAFFLE_EIP712_DOMAIN.name,
    version: RAFFLE_EIP712_DOMAIN.version,
    chainId,
    verifyingContract,
  };
}

export async function getRaffleDomainFromClient(
  client: RaffleClient,
): Promise<RaffleEip712Domain> {
  const network = await client.provider.getNetwork();
  const verifyingContract = await client.raffle.getAddress();
  return buildRaffleDomain(network.chainId, verifyingContract);
}

export function hashHostRafflePermit(
  domain: RaffleEip712Domain,
  message: HostRafflePermit,
): string {
  return ethers.TypedDataEncoder.hash(domain, HOST_RAFFLE_TYPES, message);
}

export function hashJoinRafflePermit(
  domain: RaffleEip712Domain,
  message: JoinRafflePermit,
): string {
  return ethers.TypedDataEncoder.hash(domain, JOIN_RAFFLE_TYPES, message);
}

export function hashHostAndJoinRafflePermit(
  domain: RaffleEip712Domain,
  message: HostAndJoinRafflePermit,
): string {
  return ethers.TypedDataEncoder.hash(
    domain,
    HOST_AND_JOIN_RAFFLE_TYPES,
    message,
  );
}

export async function signHostRafflePermit(
  signer: Signer,
  domain: RaffleEip712Domain,
  message: HostRafflePermit,
): Promise<string> {
  return signer.signTypedData(domain, HOST_RAFFLE_TYPES, message);
}

export async function signJoinRafflePermit(
  signer: Signer,
  domain: RaffleEip712Domain,
  message: JoinRafflePermit,
): Promise<string> {
  return signer.signTypedData(domain, JOIN_RAFFLE_TYPES, message);
}

export async function signHostAndJoinRafflePermit(
  signer: Signer,
  domain: RaffleEip712Domain,
  message: HostAndJoinRafflePermit,
): Promise<string> {
  return signer.signTypedData(domain, HOST_AND_JOIN_RAFFLE_TYPES, message);
}

export async function hostRaffleWithPermit(
  client: RaffleClient,
  params: SafeHostRaffleParams,
  signature: string,
) {
  if (!client.signer) {
    throw new Error("hostRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.hostRaffle(
    params.raffleId,
    params.totalSlots,
    params.maxSlotsPerAddress,
    params.metadataUri,
    params.collection,
    params.premintContract,
    params.premint,
    params.prizeType,
    params.prizeAmount,
    params.autoDraw,
    params.autoClaim,
    params.expiresAt,
    signature,
  );
  const receipt = await tx.wait();

  const id = ethers.id(params.raffleId);

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  const loadReport = {
    totalSlots: load[0].toString(),
    soldSlots: load[1].toString(),
    maxSlotsPerAddress: load[2].toString(),
    metadataUri: load[3],
    collection: load[4],
    premintContract: load[5],
    premint: load[6],
    autoDraw: load[7],
    autoClaim: load[8],
    createdAt: Number(load[9]),
    expiresAt: Number(load[10]),
    status: load[11],
    statusString: load[12],
    winnerSlot: load[13].toString(),
    winner: load[14],
    prizeAmount: load[15].toString(),
    prizeType: load[16],
    prizeTypeString: load[17],
    claimed: load[18],
  };

  const resultReport = {
    winnerSlot: result[0].toString(),
    winner: result[1],
    status: result[2],
    statusString: result[3],
    claimed: result[4],
    collection: result[5],
    prizeAmount: result[6].toString(),
    prizeType: result[7],
    prizeTypeString: result[8],
  };

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    raffleBytesId: id,
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    load: loadReport,
    result: resultReport,
  };
}

export async function joinRaffleWithPermit(
  client: RaffleClient,
  params: SafeJoinRaffleParams,
  signature: string,
  valueOverride?: bigint,
) {
  if (!client.signer) {
    throw new Error("joinRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.joinRaffle(
    params.raffleId,
    params.slotIds,
    params.amount,
    params.token,
    signature,
    { value: valueOverride ?? params.amount },
  );
  const receipt = await tx.wait();

  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  const loadReport = {
    totalSlots: load[0].toString(),
    soldSlots: load[1].toString(),
    maxSlotsPerAddress: load[2].toString(),
    metadataUri: load[3],
    collection: load[4],
    premintContract: load[5],
    premint: load[6],
    autoDraw: load[7],
    autoClaim: load[8],
    createdAt: Number(load[9]),
    expiresAt: Number(load[10]),
    status: load[11],
    statusString: load[12],
    winnerSlot: load[13].toString(),
    winner: load[14],
    prizeAmount: load[15].toString(),
    prizeType: load[16],
    prizeTypeString: load[17],
    claimed: load[18],
  };

  const resultReport = {
    winnerSlot: result[0].toString(),
    winner: result[1],
    status: result[2],
    statusString: result[3],
    claimed: result[4],
    collection: result[5],
    prizeAmount: result[6].toString(),
    prizeType: result[7],
    prizeTypeString: result[8],
  };

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    slotIds: params.slotIds.map((s) => s.toString()),
    paidAmountWei: params.amount.toString(),
    load: loadReport,
    result: resultReport,
  };
}

export async function hostAndJoinRaffleWithPermit(
  client: RaffleClient,
  params: SafeHostAndJoinRaffleParams,
  signature: string,
  valueOverride?: bigint,
) {
  if (!client.signer) {
    throw new Error("hostAndJoinRaffle requires a signer");
  }

  const { raffle, signer, provider } = client;
  const network = await provider.getNetwork();

  const tx = await raffle.hostAndJoinRaffle(
    params.raffleId,
    params.totalSlots,
    params.maxSlotsPerAddress,
    params.metadataUri,
    params.collection,
    params.premintContract,
    params.premint,
    params.prizeType,
    params.prizeAmount,
    params.autoDraw,
    params.autoClaim,
    params.expiresAt,
    params.slotIds,
    params.amount,
    params.token,
    params.bonusFreeSlots,
    signature,
    { value: valueOverride ?? params.amount },
  );
  const receipt = await tx.wait();

  const id = ethers.id(params.raffleId);
  const load = await raffle.getRaffleLoadDetail(params.raffleId);
  const result = await raffle.getRaffleResult(params.raffleId);

  const loadReport = {
    totalSlots: load[0].toString(),
    soldSlots: load[1].toString(),
    maxSlotsPerAddress: load[2].toString(),
    metadataUri: load[3],
    collection: load[4],
    premintContract: load[5],
    premint: load[6],
    autoDraw: load[7],
    autoClaim: load[8],
    createdAt: Number(load[9]),
    expiresAt: Number(load[10]),
    status: load[11],
    statusString: load[12],
    winnerSlot: load[13].toString(),
    winner: load[14],
    prizeAmount: load[15].toString(),
    prizeType: load[16],
    prizeTypeString: load[17],
    claimed: load[18],
  };

  const resultReport = {
    winnerSlot: result[0].toString(),
    winner: result[1],
    status: result[2],
    statusString: result[3],
    claimed: result[4],
    collection: result[5],
    prizeAmount: result[6].toString(),
    prizeType: result[7],
    prizeTypeString: result[8],
  };

  return {
    network: {
      chainId: network.chainId.toString(),
      name: network.name,
    },
    signer: await signer.getAddress(),
    raffleAddress: await raffle.getAddress(),
    raffleId: params.raffleId,
    raffleBytesId: id,
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    slotIds: params.slotIds.map((s) => s.toString()),
    paidAmountWei: params.amount.toString(),
    load: loadReport,
    result: resultReport,
  };
}
