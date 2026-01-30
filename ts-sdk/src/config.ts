// Aleo Network Configuration
export const ALEO_CONFIG = {
  network: "testnet" as const,
  endpoint: "https://api.provable.com/v2",

  // Program names
  programs: {
    collection: {
      v1: "mogate_nft_collection_rwa.aleo",
      v2: "mogate_nft_collection_rwa_v2.aleo",
    },
    gateway: {
      v1: "mogate_authority_mint_gateway.aleo",
      v2: "mogate_authority_mint_gateway_v2.aleo",
    },
  },

  // Deployment info
  deployments: {
    collection_v1: {
      programName: "mogate_nft_collection_rwa.aleo",
      transactionId:
        "at1as952eycv6h7ypdph0rj8tfzr0c89arg7gtsyztsr8x08n9hkc9sf62wjd",
      status: "deployed",
    },
    collection_v2: {
      programName: "mogate_nft_collection_rwa_v2.aleo",
      status: "pending", // Failed with HTTP 500, needs retry
    },
    gateway_v2: {
      programName: "mogate_authority_mint_gateway_v2.aleo",
      status: "pending", // Has compiler bug, needs SDK deployment
    },
  },
} as const;

// Get private key from environment
export function getPrivateKey(): string {
  const key = process.env.PRIVATE_KEY || process.env.ALEO_PVT_KEY;
  if (!key) {
    throw new Error("PRIVATE_KEY or ALEO_PVT_KEY environment variable not set");
  }
  return key;
}

// Get program paths
export function getProgramPath(program: "collection" | "gateway"): string {
  const base = process.cwd();
  return program === "collection"
    ? `${base}/programs/collection`
    : `${base}/programs/authority_mint_gateway`;
}
