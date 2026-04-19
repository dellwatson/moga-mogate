import { ethers } from "ethers";
import { fheNftConfig } from "../../config.js";

async function main() {
  const { network, vault } = fheNftConfig;

  const rpcUrl = network.rpcUrls[network.target];
  const pk = network.privateKey;

  const vaultAddress = vault.address;
  const executorAddress = vault.executor.address;
  const allowed = vault.executor.allowed;

  if (!rpcUrl)
    throw new Error(
      `RPC URL for target network '${network.target}' is required`,
    );
  if (!pk)
    throw new Error(
      "PRIVATE_KEY_ETH / PRIVATE_KEY_ETH_2 or SEPOLIA_PRIVATE_KEY is required",
    );
  if (!vaultAddress) throw new Error("VAULT_ADDRESS env var is required");
  if (!executorAddress) throw new Error("EXECUTOR_ADDRESS env var is required");

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
