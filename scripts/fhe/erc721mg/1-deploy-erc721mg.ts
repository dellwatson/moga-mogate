import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fheNftConfig } from "../config.js";

async function main() {
  const { network, deploy } = fheNftConfig;

  const rpcUrl = network.rpcUrls[network.target];
  const pk = network.privateKey;

  if (!rpcUrl)
    throw new Error(
      `RPC URL for target network '${network.target}' is required`,
    );
  if (!pk)
    throw new Error("PRIVATE_KEY_ETH or PRIVATE_KEY_ETH_2 env var is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(pk, provider);

  console.log("Deploying ERC721MG with:", await deployer.getAddress());

  const name = deploy.name;
  const symbol = deploy.symbol;

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..", "..");
  const artifactPath = path.join(
    repoRoot,
    "artifacts",
    "contracts",
    "ERC721MG.sol",
    "ERC721MG.json",
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    deployer,
  );
  const collection = await factory.deploy(name, symbol);
  const receipt = await collection.deploymentTransaction()?.wait();

  const address = await collection.getAddress();

  console.log("ERC721MG deployed to:", address);
  if (receipt) {
    console.log("Deploy tx:", receipt.hash, "block:", receipt.blockNumber);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
