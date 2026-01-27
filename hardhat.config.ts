import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const SEPOLIA_PRIVATE_KEY =
  process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY_ETH || "";
const SEPOLIA_PRIVATE_KEY_2 = process.env.PRIVATE_KEY_ETH_2 || "";

const POLYGON_AMOY_RPC_URL = process.env.POLYGON_AMOY_RPC_URL || "";
const POLYGON_AMOY_PRIVATE_KEY =
  process.env.POLYGON_AMOY_PRIVATE_KEY || process.env.PRIVATE_KEY_ETH || "";

const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || "";

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
        (pk): pk is string => !!pk && pk.length > 0,
      ),
    },
    polygonAmoy: {
      type: "http",
      url: POLYGON_AMOY_RPC_URL || "",
      chainId: 80002,
      accounts: [SEPOLIA_PRIVATE_KEY, SEPOLIA_PRIVATE_KEY_2].filter(
        (pk): pk is string => !!pk && pk.length > 0,
      ),
    },
    arbitrumSepolia: {
      type: "http",
      url: ARBITRUM_SEPOLIA_RPC_URL || "",
      chainId: 421614,
      accounts: [SEPOLIA_PRIVATE_KEY, SEPOLIA_PRIVATE_KEY_2].filter(
        (pk): pk is string => !!pk && pk.length > 0,
      ),
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./evm-test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      polygonAmoy: process.env.ETHERSCAN_API_KEY || "",
      arbitrumSepolia: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
    ],
  },
};

export default config;
