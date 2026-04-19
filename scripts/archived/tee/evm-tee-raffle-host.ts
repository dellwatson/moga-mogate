import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
  createTeeRaffleClient,
  PrivacyMode,
  PrizeTokenType,
} from "../../ts-sdk/src/tee/index.ts";

dotenv.config();

async function main() {
  const target = process.env.TARGET_NETWORK || "arbitrumSepolia";

  const rpcUrls: Record<string, string> = {
    polygonAmoy:
      process.env.POLYGON_AMOY_RPC_URL ||
      "https://polygon-amoy-bor-rpc.publicnode.com",
    arbitrumSepolia:
      process.env.ARBITRUM_SEPOLIA_RPC_URL ||
      "https://arbitrum-sepolia.infura.io/v3/68bcf4c486904a37957fb7baa53ab4e0",
    sepolia: process.env.SEPOLIA_RPC_URL || "",
  };

  const raffleAddresses: Record<string, string> = {
    arbitrumSepolia: process.env.RAFFLE_TEE_ADDRESS_ARBITRUM_SEPOLIA || "",
    sepolia: process.env.RAFFLE_TEE_ADDRESS_SEPOLIA || "",
    polygonAmoy: process.env.RAFFLE_TEE_ADDRESS_POLYGON_AMOY || "",
  };

  const rpcUrl = rpcUrls[target];
  const raffleAddress = raffleAddresses[target];

  const pk =
    process.env.PRIVATE_KEY_ETH ||
    process.env.SEPOLIA_PRIVATE_KEY ||
    process.env.PRIVATE_KEY_ETH_2;

  if (!rpcUrl)
    throw new Error("RPC URL env var is required for target network");
  if (!raffleAddress)
    throw new Error("RAFFLE_TEE_ADDRESS env var for target network is required");
  if (!pk)
    throw new Error(
      "PRIVATE_KEY_ETH / PRIVATE_KEY_ETH_2 or SEPOLIA_PRIVATE_KEY env var is required",
    );

  const client = createTeeRaffleClient({
    rpcUrl,
    privateKey: pk,
    raffleAddress,
  });

  const raffleId = process.env.RAFFLE_ID || `tee-${Date.now()}`;
  const totalSlots = BigInt(process.env.RAFFLE_TOTAL_SLOTS || "5");
  const maxTicketsPerAddress = BigInt(
    process.env.RAFFLE_MAX_TICKETS_PER_ADDRESS || "5",
  );

  const ticketPriceEth = process.env.RAFFLE_TICKET_PRICE_ETH || "0.01";
  const ticketPriceWei = ethers.parseEther(ticketPriceEth);

  const metadataUri =
    process.env.RAFFLE_METADATA_URI ||
    "https://example.com/raffle-metadata.json";

  const collection = process.env.RAFFLE_COLLECTION || ethers.ZeroAddress;
  const premintContract = process.env.RAFFLE_PREMINT_CONTRACT === "true";
  const premint = process.env.RAFFLE_PREMINT === "true";

  const prizeTypeEnv = process.env.RAFFLE_PRIZE_TYPE;
  const prizeType: PrizeTokenType =
    prizeTypeEnv !== undefined
      ? (Number(prizeTypeEnv) as PrizeTokenType)
      : PrizeTokenType.ERC721;

  const prizeAmount = BigInt(process.env.RAFFLE_PRIZE_AMOUNT || "1");

  const autoClaimEnv = process.env.RAFFLE_AUTO_CLAIM;
  const autoClaim =
    autoClaimEnv === "true"
      ? true
      : autoClaimEnv === "false"
      ? false
      : collection !== ethers.ZeroAddress;

  const expiresInSeconds = Number(
    process.env.RAFFLE_EXPIRES_IN_SECONDS || "3600",
  );
  const expiresAt = BigInt(
    Math.floor(Date.now() / 1000) + Math.max(expiresInSeconds, 0),
  );

  const privacyRaw = (process.env.RAFFLE_PRIVACY_MODE || "slots").toLowerCase();
  const privacy =
    privacyRaw === "full" || privacyRaw === "1"
      ? PrivacyMode.FULL
      : PrivacyMode.SLOTS_ONLY;

  console.log("Hosting TEE raffle on", target);
  console.log(
    JSON.stringify(
      {
        raffleAddress,
        raffleId,
        totalSlots: totalSlots.toString(),
        maxTicketsPerAddress: maxTicketsPerAddress.toString(),
        ticketPriceEth,
        metadataUri,
        collection,
        premintContract,
        premint,
        prizeType,
        prizeAmount: prizeAmount.toString(),
        autoClaim,
        expiresAt: Number(expiresAt),
        privacyMode: privacy,
      },
      null,
      2,
    ),
  );

  const overrides: Record<string, bigint> = {};
  const nonceEnv = process.env.RAFFLE_TX_NONCE || process.env.TX_NONCE;
  if (!nonceEnv) {
    throw new Error(
      "RAFFLE_TX_NONCE (or TX_NONCE) is required to avoid eth_getTransactionCount on limited RPCs.",
    );
  }
  overrides.nonce = BigInt(nonceEnv);
  const gasLimitEnv = process.env.RAFFLE_GAS_LIMIT;
  if (gasLimitEnv) {
    overrides.gasLimit = BigInt(gasLimitEnv);
  }
  const gasPriceGwei = process.env.RAFFLE_GAS_PRICE_GWEI;
  if (gasPriceGwei) {
    overrides.gasPrice = ethers.parseUnits(gasPriceGwei, "gwei");
  }
  const maxFeeGwei = process.env.RAFFLE_MAX_FEE_GWEI;
  if (maxFeeGwei) {
    overrides.maxFeePerGas = ethers.parseUnits(maxFeeGwei, "gwei");
  }
  const priorityFeeGwei = process.env.RAFFLE_PRIORITY_FEE_GWEI;
  if (priorityFeeGwei) {
    overrides.maxPriorityFeePerGas = ethers.parseUnits(priorityFeeGwei, "gwei");
  }

  const tx = await client.raffle.createRaffle(
    raffleId,
    totalSlots,
    maxTicketsPerAddress,
    ticketPriceWei,
    metadataUri,
    collection,
    premintContract,
    premint,
    prizeType,
    prizeAmount,
    autoClaim,
    expiresAt,
    privacy,
    overrides,
  );

  const receipt = await tx.wait();
  console.log("Create tx hash:", receipt?.hash ?? tx.hash);
  console.log("Raffle id hash:", ethers.id(raffleId));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
