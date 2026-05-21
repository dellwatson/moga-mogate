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
    privateKey:
      "a9d27031d50729345639276dbc8e0708215fc888955272ea0d9fae78d5223bf8",
    // privateKey: process.env.PRIVATE_KEY_ETH || process.env.PRIVATE_KEY_ETH_2,
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
    latestCollectionAddress: "0x4cf031C2ecf8ee6b08bF7ab16a49636A0FADBF9D",
    gatewayAddress: "0xA91D70aE85af28Efc23D5d90348a72A08C56056A",
    mint: {
      to: "0x72776B37a55d502E81C29103b89e84EcC81BD63d",
      // to: "0xA31A54e4C258B1BE8cE887a2724906BfCe88Cc6A",
      uri: "https://metadata.mogate.xyz/erc721mg/test.json",
      plaintextGiftcode: "other-acc-new-est-test-new-giftcode-uuid-123",
    },
    decrypt: {
      tokenId: 14,
      cipherRef: "giftcode_1779329986485.bin",
      aesKeyHex: "0xdf5773b26ebaa91d05056cb6fe08d921", // For testing only
      ciphertextHex:
        "52e39afc636a15b788e374e10d7254da529748b003c0cf1a864e7d3d32238b8bbfa49e23526cf4b7cca0548ac38e8a19aeb6aaaf4b647a3774179320237bcd6c81d2a53cd9dcef41", // Encrypted giftcode as hex
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
