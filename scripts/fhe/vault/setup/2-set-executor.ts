import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const target = process.env.TARGET_NETWORK || "sepolia";
  const vaultAddress = process.env.VAULT_ADDRESS;
  const executorAddress = process.env.EXECUTOR_ADDRESS;
  const allowed = (process.env.EXECUTOR_ALLOWED || "true").toLowerCase() !== "false";

  if (!vaultAddress) throw new Error("VAULT_ADDRESS env var is required");
  if (!executorAddress) throw new Error("EXECUTOR_ADDRESS env var is required");

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

  const pk =
    process.env.PRIVATE_KEY_ETH ||
    process.env.SEPOLIA_PRIVATE_KEY ||
    process.env.PRIVATE_KEY_ETH_2;

  if (!rpcUrl) throw new Error("RPC URL env var is required for target network");
  if (!pk) throw new Error("PRIVATE_KEY_ETH / PRIVATE_KEY_ETH_2 or SEPOLIA_PRIVATE_KEY is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  console.log("Vault:", vaultAddress);
  console.log("Setting executor:", executorAddress, "allowed:", allowed);
  console.log("Signer:", signer.address);

  const vault = new ethers.Contract(
    vaultAddress,
    ["function setExecutor(address executor, bool allowed) external"],
    signer,
  );

  const tx = await vault.setExecutor(executorAddress, allowed);
  console.log("Tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

