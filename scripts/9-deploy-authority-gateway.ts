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
  console.log(
    "Deploying AuthorityMintGateway with:",
    await deployer.getAddress()
  );

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "AuthorityMintGateway.sol",
    "AuthorityMintGateway.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    deployer
  );
  const gateway = await factory.deploy();
  const receipt = await gateway.deploymentTransaction()?.wait();

  const address = await gateway.getAddress();

  console.log("AuthorityMintGateway deployed to:", address);
  if (receipt) {
    console.log("Deploy tx:", receipt.hash, "block:", receipt.blockNumber);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
