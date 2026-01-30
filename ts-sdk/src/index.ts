// Main SDK exports
export { AleoNFTClient, createClient } from "./client.js";
export { ALEO_CONFIG, getPrivateKey, getProgramPath } from "./config.js";

// Re-export types from Aleo SDK
export type {
  Account,
  ProgramManager,
  AleoNetworkClient,
} from "@provablehq/sdk";
