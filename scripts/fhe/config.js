import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Load dotenv from project root
const __dirname = path.dirname(new URL(import.meta.url).pathname);
loadEnv({ path: path.join(__dirname, "..", "..", ".env") });
const statePath = path.join(__dirname, "erc721mg_state.json");

let lastTokenId = 0n;

try {
  const raw = fs.readFileSync(statePath, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed.lastTokenId !== undefined) {
    lastTokenId = BigInt(parsed.lastTokenId);
  }
} catch {
  // If state file doesn't exist or is invalid, keep default 0n
}

export const fheNftConfig = {
  network: {
    target: process.env.TARGET_NETWORK || "sepolia",
    rpcUrls: {
      polygonAmoy: process.env.POLYGON_AMOY_RPC_URL,
      arbitrumSepolia: process.env.ARBITRUM_SEPOLIA_RPC_URL,
      polkadotTestnet: process.env.POLKADOT_TESTNET_RPC_URL,
      // sepolia: process.env.SEPOLIA_RPC_URL,
      sepolia: "https://sepolia.drpc.org",
      // sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
      // sepolia: "https://rpc.sepolia.ethpandaops.io",
    },
    privateKey: process.env.PRIVATE_KEY_ETH || process.env.PRIVATE_KEY_ETH_2,
    privateKey2: process.env.PRIVATE_KEY_ETH_2,
    backendPrivateKey:
      process.env.BACKEND_PRIVATE_KEY || process.env.PRIVATE_KEY_ETH,
  },
  deploy: {
    name: process.env.ERC721MG_NAME || "Mogate Giftcode",
    symbol: process.env.ERC721MG_SYMBOL || "MGC",
  },
  erc721mg: {
    collectionAddress: "0xFBf8608D465D4Aa88b7fDb4Bb76c84cb7037AE55",
    mint: {
      to: "0xA31A54e4C258B1BE8cE887a2724906BfCe88Cc6A",
      uri: "https://metadata.mogate.xyz/erc721mg/test.json",
      plaintextGiftcode: "MOGATE_TEST_GIFTCODE_001",
      // AES key is generated randomly per mint
      cipherRef: "",
    },
    decrypt: {
      tokenId: 3,
      cipherRef: "giftcode_1776618540095.bin",
      giftcode: "MOGATE_TEST_GIFTCODE_540094", // For testing only
      aesKeyHex: "0x16c906e990ef08c2ac500f8744231540", // For testing only
    },
  },
  vault: {
    address: process.env.VAULT_ADDRESS,
    executor: {
      address: process.env.EXECUTOR_ADDRESS,
      allowed:
        (process.env.EXECUTOR_ALLOWED || "true").toLowerCase() !== "false",
    },
  },
};
