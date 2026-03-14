#!/usr/bin/env bun
// Centralized setup config for all setup scripts.
// Update this file once when you change program names, versions, or default addresses.

import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "../..");

loadDotenv({ path: resolve(ROOT_DIR, ".env") });
loadDotenv({ path: resolve(ROOT_DIR, ".env.setup"), override: true });

type SetupConfig = {
  labels: {
    arc721CollectionPrivate: string;
    arc721MultiPrivate: string;
    authorityMintGateway: string;
    darkPoolRafflePrivate: string;
    darkPoolRafflePrivAdv: string;
    bridgeGateway: string;
  };
  programs: {
    arc721ProgramDir: string;
    arc721MultiProgramDir: string;
    authorityProgramId: string;
    authorityProgramDir: string;
    raffleProgramId: string;
    raffleProgramDir: string;
    raffleAdvProgramId: string;
    raffleAdvProgramDir: string;
    bridgeProgramDir: string;
  };
  accounts: {
    adminAddress: string;
    backendAddress: string;
    treasuryAddress: string;
  };
  network: {
    name: string;
    endpoint: string;
    privateKey: string;
  };
  collectionDefaults: {
    collectionId: string;
    metadataBaseUrl: string;
    name: string;
    maxMintable: string;
    maxFirstEdition: string;
    publicTokenId: string;
    symbol: string; // legacy field symbol for single-collection ARC721
    symbolText: string;
    metadataUrl: string;
    isBridged: string;
    originChainId: string;
    originCollection: string;
  };
  gatewayDefaults: {
    minterProgramId: string;
    allowed: string;
  };
  scanDefaults: {
    arc721MultiStartHeight: string;
    arc721MultiRecentBlocks: string;
  };
};

// https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/aleo-network/metadata/v2-test/nfts/aleo/lezgo/200/metadata.json
// https://tinyurl.com/52jwhvxv
// https://raw.github.com/dellwatson/moga-mogate/aleo-network/metadata/v2-test/collections/aleo/lezgo/arc721/collection.json

const STATIC_CONFIG: SetupConfig = {
  labels: {
    // Example for versioning: "arc721_collection_privateV2"
    arc721CollectionPrivate: "arc721_collection_private",
    arc721MultiPrivate: "arc721_multi_private",
    authorityMintGateway: "authority_mint_gateway",
    darkPoolRafflePrivate: "dark_pool_raffle_priv_v3",
    darkPoolRafflePrivAdv: "dark_pool_raffle_privadv",
    bridgeGateway: "bridge_gateway",
  },
  programs: {
    arc721ProgramDir: "programs/arc721_collection_private",
    arc721MultiProgramDir: "programs/arc721_multi_private",
    //set_minter needs the minter program ID, not a folder path.
    authorityProgramId: "mogate_authority_mint_v5.aleo",
    authorityProgramDir: "programs/authority_mint_gateway",
    raffleProgramId: "mogate_darkpool_raffle_priv_v3.aleo",
    raffleProgramDir: "programs/dark_pool_raffle_private",
    raffleAdvProgramId: "mogate_darkpool_raffle_privadv.aleo",
    raffleAdvProgramDir: "programs/dark_pool_raffle_private_adv",
    bridgeProgramDir: "programs/bridge_gateway",
  },
  accounts: {
    // Set these once here if you do not want to pass --admin/--backend/--treasury
    adminAddress:
      "aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2",
    // Backend address is an Aleo address (NOT a private key). Used for burn receipts.
    // Override via BACKEND_ADDRESS in .env.
    backendAddress:
      "aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2",
    treasuryAddress:
      "aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2",
  },
  network: {
    name: "testnet",
    // Base host WITHOUT "/testnet". The Provable SDK appends it automatically.
    endpoint: "https://api.explorer.provable.com/v2",
    privateKey: "",
  },
  collectionDefaults: {
    collectionId: "1field",
    // Used when you pass a relative metadata path (no scheme like https://).
    metadataBaseUrl: "https://raw.github.com/dellwatson/moga-mogate/",
    name: "Lezgo-PrivateId",
    maxMintable: "0u64", // how many is this ?
    maxFirstEdition: "0u64",
    publicTokenId: "false",
    symbol: "0field",
    symbolText: "LEZGO",
    metadataUrl:
      // NOTE: On-chain URL is stored as `[field; 4]` (124 bytes max).
      // Keep the on-chain string short. Prefer relative paths + metadataBaseUrl.
      "aleo-network/metadata/v2-test/collections/aleo/lezgo/arc721/collection.json",
    isBridged: "false",
    originChainId: "0u32",
    originCollection: "native",
  },
  gatewayDefaults: {
    allowed: "true",
    minterProgramId: "mogate_authority_mint_v5.aleo",
  },
  scanDefaults: {
    // Default scan window for PrivateNFT records. This should be the deployment height.
    arc721MultiStartHeight: "14987338",
    arc721MultiRecentBlocks: "5000",
  },
};

function env(name: string): string {
  const value = process.env[name];
  return value ? String(value).trim() : "";
}

function choose(...values: string[]): string {
  for (const value of values) {
    if (value && value.trim().length > 0) return value.trim();
  }
  return "";
}

export function getSetupConfig(): SetupConfig {
  return {
    labels: {
      arc721CollectionPrivate: choose(
        env("SETUP_ARC721_LABEL"),
        STATIC_CONFIG.labels.arc721CollectionPrivate,
      ),
      arc721MultiPrivate: choose(
        env("SETUP_ARC721_MULTI_LABEL"),
        STATIC_CONFIG.labels.arc721MultiPrivate,
      ),
      authorityMintGateway: choose(
        env("SETUP_AUTHORITY_LABEL"),
        STATIC_CONFIG.labels.authorityMintGateway,
      ),
      darkPoolRafflePrivate: choose(
        env("SETUP_RAFFLE_LABEL"),
        STATIC_CONFIG.labels.darkPoolRafflePrivate,
      ),
      bridgeGateway: choose(
        env("SETUP_BRIDGE_LABEL"),
        STATIC_CONFIG.labels.bridgeGateway,
      ),
    },
    programs: {
      arc721ProgramDir: choose(
        env("ARC721_PROGRAM_DIR"),
        STATIC_CONFIG.programs.arc721ProgramDir,
      ),
      arc721MultiProgramDir: choose(
        env("ARC721_MULTI_PROGRAM_DIR"),
        STATIC_CONFIG.programs.arc721MultiProgramDir,
      ),
      authorityProgramId: choose(
        env("AUTHORITY_PROGRAM"),
        env("GATEWAY_PROGRAM"),
        STATIC_CONFIG.programs.authorityProgramId,
      ),
      authorityProgramDir: choose(
        env("AUTHORITY_PROGRAM_DIR"),
        STATIC_CONFIG.programs.authorityProgramDir,
      ),
      raffleProgramDir: choose(
        env("RAFFLE_PROGRAM_DIR"),
        STATIC_CONFIG.programs.raffleProgramDir,
      ),
      bridgeProgramDir: choose(
        env("BRIDGE_PROGRAM_DIR"),
        STATIC_CONFIG.programs.bridgeProgramDir,
      ),
    },
    accounts: {
      adminAddress: choose(
        env("ADMIN_ADDRESS"),
        STATIC_CONFIG.accounts.adminAddress,
      ),
      backendAddress: choose(
        env("BACKEND_ADDRESS"),
        STATIC_CONFIG.accounts.backendAddress,
      ),
      treasuryAddress: choose(
        env("TREASURY_ADDRESS"),
        STATIC_CONFIG.accounts.treasuryAddress,
      ),
    },
    network: {
      name: choose(env("NETWORK"), STATIC_CONFIG.network.name),
      endpoint: choose(env("ENDPOINT"), STATIC_CONFIG.network.endpoint),
      privateKey: choose(
        env("PRIVATE_KEY"),
        env("ALEO_PVT_KEY"),
        STATIC_CONFIG.network.privateKey,
      ),
    },
    collectionDefaults: {
      collectionId: choose(
        env("SETUP_COLLECTION_ID"),
        STATIC_CONFIG.collectionDefaults.collectionId,
      ),
      metadataBaseUrl: choose(
        env("SETUP_METADATA_BASE_URL"),
        STATIC_CONFIG.collectionDefaults.metadataBaseUrl,
      ),
      name: choose(
        env("SETUP_COLLECTION_NAME"),
        STATIC_CONFIG.collectionDefaults.name,
      ),
      maxMintable: choose(
        env("SETUP_MAX_MINTABLE"),
        STATIC_CONFIG.collectionDefaults.maxMintable,
      ),
      maxFirstEdition: choose(
        env("SETUP_MAX_FIRST_EDITION"),
        STATIC_CONFIG.collectionDefaults.maxFirstEdition,
      ),
      publicTokenId: choose(
        env("SETUP_PUBLIC_TOKEN_ID"),
        STATIC_CONFIG.collectionDefaults.publicTokenId,
      ),
      symbol: choose(
        env("SETUP_SYMBOL"),
        STATIC_CONFIG.collectionDefaults.symbol,
      ),
      symbolText: choose(
        env("SETUP_SYMBOL_TEXT"),
        STATIC_CONFIG.collectionDefaults.symbolText,
      ),
      metadataUrl: choose(
        env("SETUP_COLLECTION_METADATA_URL"),
        STATIC_CONFIG.collectionDefaults.metadataUrl,
      ),
      isBridged: choose(
        env("SETUP_COLLECTION_BRIDGED"),
        STATIC_CONFIG.collectionDefaults.isBridged,
      ),
      originChainId: choose(
        env("SETUP_COLLECTION_ORIGIN_CHAIN"),
        STATIC_CONFIG.collectionDefaults.originChainId,
      ),
      originCollection: choose(
        env("SETUP_COLLECTION_ORIGIN"),
        STATIC_CONFIG.collectionDefaults.originCollection,
      ),
    },
    gatewayDefaults: {
      allowed: choose(
        env("SETUP_ALLOWED"),
        STATIC_CONFIG.gatewayDefaults.allowed,
      ),
      minterProgramId: choose(
        env("SETUP_MINTER_PROGRAM"),
        env("AUTHORITY_PROGRAM"),
        env("GATEWAY_PROGRAM"),
        STATIC_CONFIG.gatewayDefaults.minterProgramId,
      ),
    },
    scanDefaults: {
      arc721MultiStartHeight: choose(
        env("SETUP_ARC721_MULTI_START_HEIGHT"),
        STATIC_CONFIG.scanDefaults.arc721MultiStartHeight,
      ),
      arc721MultiRecentBlocks: choose(
        env("SETUP_ARC721_MULTI_RECENT_BLOCKS"),
        STATIC_CONFIG.scanDefaults.arc721MultiRecentBlocks,
      ),
    },
  };
}

export function getStepLabel(
  program:
    | "arc721CollectionPrivate"
    | "arc721MultiPrivate"
    | "authorityMintGateway"
    | "darkPoolRafflePrivate"
    | "darkPoolRafflePrivAdv"
    | "bridgeGateway",
  stepName: string,
): string {
  const cfg = getSetupConfig();
  return `Setup: ${cfg.labels[program]}.${stepName}`;
}
