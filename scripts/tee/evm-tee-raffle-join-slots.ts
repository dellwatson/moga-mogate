import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
  buildSlotCommitment,
  createTeeRaffleClient,
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
      "https://sepolia-rollup.arbitrum.io/rpc",
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

  const raffleId = process.env.RAFFLE_ID;
  if (!raffleId) throw new Error("RAFFLE_ID env var is required");

  const slotIdsRaw = process.env.RAFFLE_SLOT_IDS || "1";
  const slotIds = slotIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => BigInt(s));

  const salt =
    process.env.RAFFLE_COMMITMENT_SALT ||
    ethers.hexlify(ethers.randomBytes(32));

  const buyer = await client.signer.getAddress();

  const commitments = slotIds.map((slotId) =>
    buildSlotCommitment({
      raffleId,
      slotId,
      salt,
      buyer,
    }),
  );

  const raffleInfo = await client.raffle.getRaffle(raffleId);
  const ticketPriceWei = BigInt(raffleInfo[5].toString());
  const totalValue = ticketPriceWei * BigInt(commitments.length);

  console.log("Joining TEE raffle (slots-only) on", target);
  console.log(
    JSON.stringify(
      {
        raffleAddress,
        raffleId,
        slotIds: slotIds.map((s) => s.toString()),
        ticketPriceWei: ticketPriceWei.toString(),
        totalValueWei: totalValue.toString(),
        salt,
        commitments,
      },
      null,
      2,
    ),
  );

  const tx = await client.raffle.joinSlotsOnly(raffleId, commitments, {
    value: totalValue,
  });
  const receipt = await tx.wait();
  console.log("Join tx hash:", receipt?.hash ?? tx.hash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
