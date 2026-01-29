import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying Raffle with account:", deployer.address);
  const balance = await deployer.getBalance();
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  const Raffle = await ethers.getContractFactory("Raffle");
  const raffle = await Raffle.deploy();

  await raffle.waitForDeployment();
  const address = await raffle.getAddress();

  console.log("Raffle deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
