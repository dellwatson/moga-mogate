#!/usr/bin/env bun
// Sign bridge claim for mogate_bridge_gateway.aleo.

import fs from "fs";
import { Plaintext, PrivateKey, PrivateKeyCiphertext } from "@provablehq/wasm";
import {
  buildBridgeClaimLiteral,
} from "../ts-sdk/src/modules/index.ts";
import { getArg, hasFlag, isMain, resolvePrivateKey } from "./aleo-utils.ts";

function requireArg(name: string): string {
  const value = getArg(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function maybeRead(pathArg: string): string | undefined {
  const path = getArg(pathArg);
  if (!path) return undefined;
  return fs.readFileSync(path, "utf8").trim();
}

function resolveSignerKey(): PrivateKey {
  const directKey = getArg("private-key");
  if (directKey) {
    return PrivateKey.from_string(directKey);
  }

  const ciphertext =
    getArg("ciphertext") ||
    maybeRead("ciphertext-file");
  if (ciphertext) {
    const secret = getArg("secret") || process.env.PERMIT_KEY_SECRET;
    if (!secret) {
      throw new Error("Encrypted key input requires --secret (or PERMIT_KEY_SECRET).");
    }
    const encrypted = PrivateKeyCiphertext.fromString(ciphertext);
    return encrypted.decryptToPrivateKey(secret);
  }

  return PrivateKey.from_string(resolvePrivateKey());
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

  const outPath = getArg("out");
  const jsonOutput = hasFlag("json");

  const signerKey = resolveSignerKey();
  const signerAddress = signerKey.to_address().to_string();

  const claimBytes = Plaintext.fromString(claimLiteral).toBytesLe();
  const signature = signerKey.sign(claimBytes).to_string();

  const output = {
    signer: signerAddress,
    claim_literal: claimLiteral,
    signature,
  };

  if (outPath) {
    fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Bridge claim signature written to: ${outPath}`);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Signer:      ${output.signer}`);
  console.log(`Claim:       ${output.claim_literal}`);
  console.log(`Signature:   ${output.signature}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
