import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const target = process.env.TARGET_NETWORK || "arbitrumSepolia";

  const iexecHubByNetwork: Record<string, string> = {
    arbitrumSepolia:
      process.env.IEXEC_HUB_ADDRESS_ARBITRUM_SEPOLIA ||
      "0xB2157BF2fAb286b2A4170E3491Ac39770111Da3E",
    arbitrumOne:
      process.env.IEXEC_HUB_ADDRESS_ARBITRUM_ONE ||
      "0x098bFCb1E50ebcA0BaA92C12eA0c3F045A1aD9f0",
  };

  const iexecHub =
    process.env.IEXEC_HUB_ADDRESS || iexecHubByNetwork[target];

  if (!iexecHub) {
    throw new Error(
      "IEXEC_HUB_ADDRESS (or network default) is required for deployment",
    );
  }

  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying RaffleTEE with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Target network:", target);
  console.log("iExec Hub address:", iexecHub);

  const RaffleTEE = await hre.ethers.getContractFactory("RaffleTEE");
  const raffle = await RaffleTEE.deploy(iexecHub);

  await raffle.waitForDeployment();
  const address = await raffle.getAddress();

  console.log("RaffleTEE deployed to:", address);
  console.log("Deploy transaction hash:", raffle.deploymentTransaction()?.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
