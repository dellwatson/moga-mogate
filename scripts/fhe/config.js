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
      sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
      // sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
      // sepolia: "https://rpc.sepolia.ethpandaops.io",
    },
    // privateKey:
    //   "a9d27031d50729345639276dbc8e0708215fc888955272ea0d9fae78d5223bf8",
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
    //sepolia
    collectionAddress: "0xFBf8608D465D4Aa88b7fDb4Bb76c84cb7037AE55", // old not used anymore overall
    latestCollectionAddress: "0x4cf031C2ecf8ee6b08bF7ab16a49636A0FADBF9D",
    // gatewayAddress: "0x0E6aE325c227355219F31D37039C1bf0BfF0d8a5", // old gateway
    gatewayAddress: "0x98f7EBAedE6248a98a7B9107307EA2d56b143759", // updated FHERC20 gateway
    FHE_gatewayAddress: "0x98f7EBAedE6248a98a7B9107307EA2d56b143759",
    fherc20: {
      cUSDC: "0x6bb9EA14E43FfA04F53128723B91f933C86d5e00",
      decimals: 6,
      network: "sepolia",
    },
    mint: {
      // to: "0x72776B37a55d502E81C29103b89e84EcC81BD63d",
      to: "0xA31A54e4C258B1BE8cE887a2724906BfCe88Cc6A",
      uri: "https://metadata.mogate.xyz/erc721mg/test.json",
      plaintextGiftcode: "other-acc-new-est-test-new-giftcode-uuid-123",
    },
    decrypt: {
      tokenId: 36,
      cipherRef:
        "http://127.0.0.1:9800/d3kd1qvkoudjtibpmo20/giftcard-ciphertext/giftcode_1779647273871_01f7e09d-f683-4334-9ca5-57f58e3d7ab8.ciphertext",
      aesKeyHex: "0x80a3248f7aafe584149e3dcff7e8d645", // For testing only
      ciphertextHex:
        "1ae777ddb15f0301047c70b4e1ad92fab1d15a6d150485efdef608953fa7a1d4891548bb15cdd0834b67a27df5173381c4b4b8e12a764130c20564f9d3d3d8e849b0aa4803e59407", // Encrypted giftcode as hex
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
