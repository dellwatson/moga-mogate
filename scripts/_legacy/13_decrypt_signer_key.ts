#!/usr/bin/env bun
// Decrypt an encrypted Aleo signer key.

import fs from "fs";
import { PrivateKeyCiphertext } from "@provablehq/wasm";
import { getArg, hasFlag, isMain } from "./aleo-utils.ts";

function requireSecret(): string {
  const secret = getArg("secret") || process.env.PERMIT_KEY_SECRET;
  if (!secret) {
    throw new Error("Missing --secret (or PERMIT_KEY_SECRET) to decrypt key.");
  }
  return secret;
}

function requireCiphertext(): string {
  const direct = getArg("ciphertext");
  if (direct) return direct;

  const filePath = getArg("ciphertext-file");
  if (filePath) {
    return fs.readFileSync(filePath, "utf8").trim();
  }

  throw new Error("Missing --ciphertext or --ciphertext-file.");
}

async function main() {
  const secret = requireSecret();
  const ciphertext = requireCiphertext();
  const outputPath = getArg("out");
  const printPrivateKey = hasFlag("print-private-key");

  const encrypted = PrivateKeyCiphertext.fromString(ciphertext);
  const privateKey = encrypted.decryptToPrivateKey(secret);
  const privateKeyText = privateKey.to_string();
  const address = privateKey.to_address().to_string();

  if (outputPath) {
    fs.writeFileSync(outputPath, `${privateKeyText}\n`, "utf8");
    console.log(`Private key written to: ${outputPath}`);
  }

  console.log(`Signer address: ${address}`);
  if (printPrivateKey) {
    console.log(privateKeyText);
  } else {
    console.log("Private key decrypted. Use --print-private-key to print it.");
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
