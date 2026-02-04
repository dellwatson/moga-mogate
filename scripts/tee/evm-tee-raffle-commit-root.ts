import * as dotenv from "dotenv";
import { createTeeRaffleClient } from "../../ts-sdk/src/tee/index.ts";

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

  const raffleId = process.env.RAFFLE_ID;
  if (!raffleId) throw new Error("RAFFLE_ID env var is required");

  const ticketsRoot = process.env.RAFFLE_TICKETS_ROOT;
  if (!ticketsRoot) throw new Error("RAFFLE_TICKETS_ROOT env var is required");

  const soldTickets = BigInt(process.env.RAFFLE_SOLD_TICKETS || "0");

  const client = createTeeRaffleClient({
    rpcUrl,
    privateKey: pk,
    raffleAddress,
  });

  console.log("Committing tickets root on", target);
  console.log(
    JSON.stringify(
      {
        raffleAddress,
        raffleId,
        ticketsRoot,
        soldTickets: soldTickets.toString(),
      },
      null,
      2,
    ),
  );

  const tx = await client.raffle.commitTicketsRoot(
    raffleId,
    ticketsRoot,
    soldTickets,
  );
  const receipt = await tx.wait();
  console.log("Commit root tx hash:", receipt?.hash ?? tx.hash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
