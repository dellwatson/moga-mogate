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
    authorityMintGateway: string;
    darkPoolRafflePrivate: string;
  };
  programs: {
    arc721ProgramDir: string;
    authorityProgramId: string;
    authorityProgramDir: string;
    raffleProgramDir: string;
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
    maxMintable: string;
    maxFirstEdition: string;
    symbol: string;
  };
  gatewayDefaults: {
    minterProgramId: string;
    allowed: string;
  };
};

const STATIC_CONFIG: SetupConfig = {
  labels: {
    // Example for versioning: "arc721_collection_privateV2"
    arc721CollectionPrivate: "arc721_collection_private",
    authorityMintGateway: "authority_mint_gateway",
    darkPoolRafflePrivate: "dark_pool_raffle_private",
  },
  programs: {
    arc721ProgramDir: "programs/arc721_collection_private",
    //set_minter needs the minter program ID, not a folder path.
    authorityProgramId: "mogate_authority_mint_v3.aleo",
    authorityProgramDir: "programs/authority_mint_gateway",
    raffleProgramDir: "programs/dark_pool_raffle_private",
  },
  accounts: {
    // Set these once here if you do not want to pass --admin/--backend/--treasury
    adminAddress:
      "aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2",
    backendAddress:
      "aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2",
    treasuryAddress:
      "aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2",
  },
  network: {
    name: "testnet",
    endpoint: "https://api.provable.com/v2",
    privateKey: "",
  },
  collectionDefaults: {
    maxMintable: "0u64",
    maxFirstEdition: "0u64",
    symbol: "0field",
  },
  gatewayDefaults: {
    allowed: "true",
    minterProgramId: "mogate_authority_mint_v3.aleo",
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
        STATIC_CONFIG.labels.arc721CollectionPrivate,
        env("SETUP_ARC721_LABEL"),
      ),
      authorityMintGateway: choose(
        STATIC_CONFIG.labels.authorityMintGateway,
        env("SETUP_AUTHORITY_LABEL"),
      ),
      darkPoolRafflePrivate: choose(
        STATIC_CONFIG.labels.darkPoolRafflePrivate,
        env("SETUP_RAFFLE_LABEL"),
      ),
    },
    programs: {
      arc721ProgramDir: choose(
        STATIC_CONFIG.programs.arc721ProgramDir,
        env("ARC721_PROGRAM_DIR"),
      ),
      authorityProgramId: choose(
        STATIC_CONFIG.programs.authorityProgramId,
        env("AUTHORITY_PROGRAM"),
        env("GATEWAY_PROGRAM"),
      ),
      raffleProgramDir: choose(
        STATIC_CONFIG.programs.raffleProgramDir,
        env("RAFFLE_PROGRAM_DIR"),
      ),
    },
    accounts: {
      adminAddress: choose(
        STATIC_CONFIG.accounts.adminAddress,
        env("ADMIN_ADDRESS"),
      ),
      backendAddress: choose(
        STATIC_CONFIG.accounts.backendAddress,
        env("BACKEND_ADDRESS"),
      ),
      treasuryAddress: choose(
        STATIC_CONFIG.accounts.treasuryAddress,
        env("TREASURY_ADDRESS"),
      ),
    },
    network: {
      name: choose(STATIC_CONFIG.network.name, env("NETWORK")),
      endpoint: choose(STATIC_CONFIG.network.endpoint, env("ENDPOINT")),
      privateKey: choose(
        STATIC_CONFIG.network.privateKey,
        env("PRIVATE_KEY"),
        env("ALEO_PVT_KEY"),
      ),
    },
    collectionDefaults: {
      maxMintable: choose(
        STATIC_CONFIG.collectionDefaults.maxMintable,
        env("SETUP_MAX_MINTABLE"),
      ),
      maxFirstEdition: choose(
        STATIC_CONFIG.collectionDefaults.maxFirstEdition,
        env("SETUP_MAX_FIRST_EDITION"),
      ),
      symbol: choose(
        STATIC_CONFIG.collectionDefaults.symbol,
        env("SETUP_SYMBOL"),
      ),
    },
    gatewayDefaults: {
      allowed: choose(
        STATIC_CONFIG.gatewayDefaults.allowed,
        env("SETUP_ALLOWED"),
      ),
      minterProgramId: choose(
        STATIC_CONFIG.gatewayDefaults.minterProgramId,
        env("SETUP_MINTER_PROGRAM"),
        env("AUTHORITY_PROGRAM"),
        env("GATEWAY_PROGRAM"),
      ),
    },
  };
}

export function getStepLabel(
  program:
    | "arc721CollectionPrivate"
    | "authorityMintGateway"
    | "darkPoolRafflePrivate",
  stepName: string,
): string {
  const cfg = getSetupConfig();
  return `Setup: ${cfg.labels[program]}.${stepName}`;
}
