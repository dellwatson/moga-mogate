import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const SEPOLIA_PRIVATE_KEY =
  process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY_ETH || "";
const SEPOLIA_PRIVATE_KEY_2 = process.env.PRIVATE_KEY_ETH_2 || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  defaultNetwork: "sepolia",
  networks: {
    sepolia: {
      type: "http",
      url: SEPOLIA_RPC_URL || "",
      accounts: [SEPOLIA_PRIVATE_KEY, SEPOLIA_PRIVATE_KEY_2].filter(
        (pk): pk is string => !!pk && pk.length > 0
      ),
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./evm-test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
