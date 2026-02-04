import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const pk = process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY_ETH;
  if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL env var is required");
  if (!pk)
    throw new Error(
      "SEPOLIA_PRIVATE_KEY or PRIVATE_KEY_ETH env var is required"
    );

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(pk, provider);

  console.log("Deploying Collection with:", await deployer.getAddress());

  const name = process.env.COLLECTION_NAME || "Mogate Collection";
  const symbol = process.env.COLLECTION_SYMBOL || "MOGC";

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..");
  const artifactPath = path.join(
    repoRoot,
    "artifacts",
    "contracts",
    "Collection.sol",
    "Collection.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    deployer
  );
  const collection = await factory.deploy(name, symbol);
  const receipt = await collection.deploymentTransaction()?.wait();

  const address = await collection.getAddress();

  console.log("Collection deployed to:", address);
  if (receipt) {
    console.log("Deploy tx:", receipt.hash, "block:", receipt.blockNumber);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
