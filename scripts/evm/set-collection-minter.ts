import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const target = process.env.TARGET_NETWORK || "sepolia";

  let rpcUrl: string | undefined;
  if (target === "polygonAmoy") {
    rpcUrl = process.env.POLYGON_AMOY_RPC_URL;
  } else if (target === "arbitrumSepolia") {
    rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
  } else if (target === "polkadotTestnet") {
    rpcUrl = process.env.POLKADOT_TESTNET_RPC_URL;
  } else {
    rpcUrl = process.env.SEPOLIA_RPC_URL;
  }

  const pk = process.env.PRIVATE_KEY_ETH || process.env.PRIVATE_KEY_ETH_2;
  if (!rpcUrl) throw Error("RPC URL env var is required for target network");
  if (!pk)
    throw Error("PRIVATE_KEY_ETH or PRIVATE_KEY_ETH_2 env var is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(pk, provider);

  console.log("Setting minter with:", await deployer.getAddress());

  // Collection contract address
  const collectionAddress = "0x453DFfb360d8fdAFd952e368c6fD4e23517A4004";

  // RaffleWithVaultV1 contract address (newly deployed)
  const raffleAddress = "0xd9BE22B53141e2F2f0A0d6897e5EdF15DD1ab5b2";

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..");
  const artifactPath = path.join(
    repoRoot,
    "artifacts",
    "contracts",
    "Collection.sol",
    "Collection.json",
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const collection = new ethers.Contract(
    collectionAddress,
    artifact.abi,
    deployer,
  );

  // Set the raffle contract as a minter
  console.log("Setting minter...");
  console.log("Collection:", collectionAddress);
  console.log("New Minter:", raffleAddress);

  const tx = await collection.setMinter(raffleAddress, true);
  const receipt = await tx.wait();

  console.log("✅ Minter set successfully!");
  console.log("Tx hash:", receipt.hash);
  console.log("Block:", receipt.blockNumber);

  // Verify the minter was set
  const isMinter = await collection.minters(raffleAddress);
  console.log("Is minter set:", isMinter);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
