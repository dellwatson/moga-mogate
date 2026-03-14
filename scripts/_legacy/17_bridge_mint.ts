#!/usr/bin/env bun
// Mint bridged NFT on Aleo via mogate_bridge_gateway.aleo.

import {
  createClientFromArgs,
  getArg,
  isMain,
} from "./aleo-utils.ts";
import {
  buildBridgeClaimLiteral,
  mintBridged,
  mintBridgedPublicId,
} from "../ts-sdk/src/modules/index.ts";

function requireArg(name: string): string {
  const value = getArg(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function main() {
  const claimLiteral = buildBridgeClaimLiteral({
    collectionId: requireArg("collection"),
    recipient: requireArg("recipient"),
    originChainId: Number(requireArg("origin-chain")),
    originCollection: requireArg("origin-collection"),
    originTokenId: Number(requireArg("origin-token-id")),
    metadataUrl: requireArg("metadata-url"),
    nonce: Number(requireArg("nonce")),
  });

  const signer = requireArg("signer");
  const signature = requireArg("signature");
  const usePublicTokenId = getArg("public-token-id") === "true";

  const client = await createClientFromArgs();
  const txId = usePublicTokenId
    ? await mintBridgedPublicId(client, { claimLiteral, signer, signature })
    : await mintBridged(client, { claimLiteral, signer, signature });

  console.log("✅ Bridged mint broadcasted");
  console.log(`Transaction: ${txId}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
