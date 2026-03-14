#!/usr/bin/env bun
// Setup step 01: gateway initialize (noop)
//
// The authority mint gateway is intentionally stateless and has no initialize().
// This script:
// - prints the configured gateway program id (from setup.config.ts)
// - optionally checks that the program exists on the configured endpoint
// - reminds you to whitelist the gateway in ARC721 via arc721_multi_private.03_set_minter.ts

import { getSetupConfig, getStepLabel } from "./setup.config.ts";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function tryFetch(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: String(e) };
  }
}

async function main() {
  const cfg = getSetupConfig();

  const programId = getArg("program") || cfg.programs.authorityProgramId;
  const network = getArg("network") || cfg.network.name;
  const endpoint = getArg("endpoint") || cfg.network.endpoint;

  console.log(getStepLabel("authorityMintGateway", "01_initialize"));
  console.log("");
  console.log("Gateway initialize: NOOP (stateless program).");
  console.log(`Gateway program: ${programId}`);
  console.log(`Network:         ${network}`);
  console.log(`Endpoint:        ${endpoint}`);
  console.log("");

  // Best-effort existence check (API paths differ across providers).
  const base = withTrailingSlash(endpoint);
  const candidates = [
    `${base}/${network}/program/${encodeURIComponent(programId)}`,
    `${base}/${network}/program/${encodeURIComponent(programId)}/latest_edition`,
  ];

  for (const url of candidates) {
    const out = await tryFetch(url);
    if (out.status === 404) continue;
    if (out.ok) {
      console.log(`✅ Program reachable: ${url}`);
      break;
    }
  }

  console.log("");
  console.log("Next step (required): whitelist the gateway as minter in ARC721:");
  console.log("  bun scripts/setup/arc721_multi_private.03_set_minter.ts");
}

main().catch((e) => {
  console.error("Setup failed:", e);
  process.exit(1);
});

