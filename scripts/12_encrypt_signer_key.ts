#!/usr/bin/env bun
// Encrypt an Aleo private key for backend permit-signing workflows.

import fs from "fs";
import { PrivateKey } from "@provablehq/wasm";
import { getArg, hasFlag, isMain, resolvePrivateKey } from "./aleo-utils.ts";

function requireSecret(): string {
  const secret = getArg("secret") || process.env.PERMIT_KEY_SECRET;
  if (!secret) {
    throw new Error("Missing --secret (or PERMIT_KEY_SECRET) to encrypt key.");
  }
  return secret;
}

function resolveSignerKey(): string {
  const cliKey = getArg("private-key");
  if (cliKey) return cliKey;
  return resolvePrivateKey();
}

async function main() {
  const secret = requireSecret();
  const signerKey = resolveSignerKey();
  const outPath = getArg("out");
  const pk = PrivateKey.from_string(signerKey);
  const ciphertext = pk.toCiphertext(secret).toString();

  if (outPath) {
    fs.writeFileSync(outPath, `${ciphertext}\n`, "utf8");
    console.log(`Ciphertext written to: ${outPath}`);
  }

  if (!hasFlag("no-print")) {
    console.log(ciphertext);
  }

  console.log(`Signer address: ${pk.to_address().to_string()}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
