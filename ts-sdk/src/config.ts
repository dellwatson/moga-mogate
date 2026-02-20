// Load environment variables from project root
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../../.env") });

// Aleo Network Configuration
export const ALEO_CONFIG = {
  network: "testnet" as const,
  endpoint: "https://api.provable.com/v2",

  // Program names
  programs: {
    arc721Private: "mogate_arc721_private.aleo",
    rafflePrivate: "mogate_darkpool_raffle_private.aleo",
    gateway: "mogate_authority_mint_v2.aleo",
    // Legacy (kept for reference)
    collection: {
      v1: "mogate_nft_collection_rwa.aleo",
      v2: "mogate_nft_collection_rwa_v2.aleo",
    },
    gatewayLegacy: {
      v1: "mogate_authority_mint_gateway.aleo",
      v2: "mogate_authority_mint_v2.aleo",
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
      programName: "mogate_authority_mint_v2.aleo",
      transactionId:
        "at1h5uauul7hvn63qpka495vxtpglgvfjkp4y5eh06cdwqwtrznwv8qrkl2uj",
      status: "deployed",
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
export function getProgramPath(program: "collection" | "gateway" | "arc721Private" | "rafflePrivate"): string {
  const base = process.cwd();
  if (program === "collection") {
    return `${base}/programs/collection`;
  }
  if (program === "arc721Private") {
    return `${base}/programs/arc721_collection_private`;
  }
  if (program === "rafflePrivate") {
    return `${base}/programs/dark_pool_raffle_private`;
  }
  return `${base}/programs/authority_mint_gateway`;
}
