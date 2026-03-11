#!/usr/bin/env bun
// Sign mint permit data for mogate_auth_mint_permit.aleo.

import fs from "fs";
import { Plaintext, PrivateKey, PrivateKeyCiphertext } from "@provablehq/wasm";
import { ensureFieldSuffix, getArg, hasFlag, isMain, resolvePrivateKey } from "./aleo-utils.ts";

function ensureU64Suffix(value: string): string {
  return value.endsWith("u64") ? value : `${value}u64`;
}

function requireArg(name: string): string {
  const value = getArg(name);
  if (!value) {
    throw new Error(`Missing --${name}`);
  }
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
  const collectionId = ensureFieldSuffix(requireArg("collection"));
  const recipient = requireArg("recipient");
  const nftCommit = ensureFieldSuffix(requireArg("nft-commit"));
  const nonce = ensureU64Suffix(requireArg("nonce"));
  const outPath = getArg("out");
  const jsonOutput = hasFlag("json");

  const signerKey = resolveSignerKey();
  const signerAddress = signerKey.to_address().to_string();

  const permitLiteral = `{collection_id: ${collectionId}, recipient: ${recipient}, nft_commit: ${nftCommit}, nonce: ${nonce}}`;
  const permitBytes = Plaintext.fromString(permitLiteral).toBytesLe();
  const signature = signerKey.sign(permitBytes).to_string();

  const output = {
    signer: signerAddress,
    collection_id: collectionId,
    recipient,
    nft_commit: nftCommit,
    nonce,
    permit_literal: permitLiteral,
    signature,
  };

  if (outPath) {
    fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Permit signature payload written to: ${outPath}`);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Signer:        ${output.signer}`);
  console.log(`Collection:    ${output.collection_id}`);
  console.log(`Recipient:     ${output.recipient}`);
  console.log(`NFT Commit:    ${output.nft_commit}`);
  console.log(`Nonce:         ${output.nonce}`);
  console.log(`Permit Data:   ${output.permit_literal}`);
  console.log(`Signature:     ${output.signature}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
