import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const SEPOLIA_PRIVATE_KEY_2 = process.env.PRIVATE_KEY_ETH_2 || "";

const POLYGON_AMOY_RPC_URL = process.env.POLYGON_AMOY_RPC_URL || "";

const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || "";

const POLKADOT_TESTNET_RPC_URL =
  process.env.POLKADOT_TESTNET_RPC_URL || "https://eth-rpc-testnet.polkadot.io";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
  },
  defaultNetwork: "sepolia",
  networks: {
    sepolia: {
      type: "http",
      url: SEPOLIA_RPC_URL || "",
      accounts: [
        process.env.PRIVATE_KEY_ETH || "",
        SEPOLIA_PRIVATE_KEY_2,
      ].filter((pk): pk is string => !!pk && pk.length > 0),
    },
    polygonAmoy: {
      type: "http",
      url: POLYGON_AMOY_RPC_URL || "",
      chainId: 80002,
      accounts: [process.env.PRIVATE_KEY_ETH || ""].filter(
        (pk): pk is string => !!pk && pk.length > 0,
      ),
    },
    arbitrumSepolia: {
      type: "http",
      url: ARBITRUM_SEPOLIA_RPC_URL || "",
      chainId: 421614,
      accounts: [process.env.PRIVATE_KEY_ETH || ""].filter(
        (pk): pk is string => !!pk && pk.length > 0,
      ),
    },
    polkadotTestnet: {
      type: "http",
      url: POLKADOT_TESTNET_RPC_URL || "",
      chainId: 420420417,
      accounts: [process.env.PRIVATE_KEY_ETH || ""].filter(
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
      polkadotTestnet: process.env.ETHERSCAN_API_KEY || "",
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
      {
        network: "polkadotTestnet",
        chainId: 1000,
        urls: {
          apiURL: "https://api.polkadot-testnet.com/api",
          browserURL: "https://polkadot-testnet.com",
        },
      },
    ],
  },
};

export default config;
