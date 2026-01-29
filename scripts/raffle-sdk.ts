import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

export enum PrizeTokenType {
  NONE = 0,
  ERC721 = 1,
  ERC1155 = 2,
  ERC404 = 3,
}

export type RaffleClientConfig = {
  rpcUrl: string;
  privateKey: string;
  raffleAddress: string;
};

export type RaffleClient = {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
  raffle: ethers.Contract;
};

function loadRaffleArtifact() {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "Raffle.sol",
    "Raffle.json",
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return artifact;
}

export function createRaffleClient(config: RaffleClientConfig): RaffleClient {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.privateKey, provider);
  const artifact = loadRaffleArtifact();
  const raffle = new ethers.Contract(
    config.raffleAddress,
    artifact.abi,
    signer,
  );
  return { provider, signer, raffle };
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

export async function unsafeHostRaffleWithReport(
  client: RaffleClient,
  params: UnsafeHostRaffleParams,
) {
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
