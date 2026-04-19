import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import * as dotenv from "dotenv";

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

  const rpcUrl = rpcUrls[target];
  if (!rpcUrl) {
    throw new Error("RPC URL env var is required for target network");
  }

  const pk =
    process.env.PRIVATE_KEY_ETH ||
    process.env.SEPOLIA_PRIVATE_KEY ||
    process.env.PRIVATE_KEY_ETH_2;
  if (!pk) {
    throw new Error(
      "PRIVATE_KEY_ETH / PRIVATE_KEY_ETH_2 or SEPOLIA_PRIVATE_KEY env var is required",
    );
  }

  const iexecHubByNetwork: Record<string, string> = {
    arbitrumSepolia:
      process.env.IEXEC_HUB_ADDRESS_ARBITRUM_SEPOLIA ||
      "0xB2157BF2fAb286b2A4170E3491Ac39770111Da3E",
    arbitrumOne:
      process.env.IEXEC_HUB_ADDRESS_ARBITRUM_ONE ||
      "0x098bFCb1E50ebcA0BaA92C12eA0c3F045A1aD9f0",
  };

  const iexecHub = process.env.IEXEC_HUB_ADDRESS || iexecHubByNetwork[target];

  if (!iexecHub) {
    throw new Error(
      "IEXEC_HUB_ADDRESS (or network default) is required for deployment",
    );
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(pk, provider);

  console.log("Deploying RaffleTEE with account:", deployer.address);
  console.log("Target network:", target);
  console.log("iExec Hub address:", iexecHub);

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..");
  const artifactPath = path.join(
    repoRoot,
    "artifacts",
    "contracts",
    "RaffleTEE.sol",
    "RaffleTEE.json",
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "Contract artifact not found. Run `npx hardhat compile --config hardhat.compile.config.ts` first.",
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    deployer,
  );

  const raffle = await factory.deploy(iexecHub);
  await raffle.waitForDeployment();

  const address = await raffle.getAddress();
  const deployTx = raffle.deploymentTransaction();

  console.log("RaffleTEE deployed to:", address);
  console.log("Deploy transaction hash:", deployTx?.hash);
  console.log("Block number:", deployTx?.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
