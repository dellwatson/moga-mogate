/**
 * EVM Permit API Server (Bun native)
 * Provides endpoints for signing host, join, and host-and-join permits
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { resolvePrivateKey } from "../core/crypto.ts";
import {
  signHostPermit,
  signJoinPermit,
  signHostAndJoinPermit,
} from "../services/permit.ts";
import {
  jsonResponse,
  requireApiKey,
  withCors,
  hostMessageToJson,
  joinMessageToJson,
  hostAndJoinMessageToJson,
} from "./utils.ts";

dotenv.config();

const PORT = Number(process.env.EVM_PERMIT_SERVER_PORT || 3011);
const HOST = process.env.EVM_PERMIT_SERVER_HOST || "127.0.0.1";
const API_KEY = process.env.EVM_PERMIT_SERVER_API_KEY || "";

const backendPk = resolvePrivateKey("BACKEND_SIGNER_PRIVATE_KEY", [
  "PRIVATE_KEY_ETH_2",
  "PRIVATE_KEY_ETH",
]);
const backendSigner = new ethers.Wallet(backendPk);

async function handleSignHost(
  body: Record<string, unknown>,
): Promise<Response> {
  const result = await signHostPermit(backendSigner, body);

  return jsonResponse(200, {
    domain: {
      ...result.domain,
      chainId: result.domain.chainId.toString(),
    },
    message: hostMessageToJson(result.message),
    signature: result.signature,
    digest: result.digest,
    backendSigner: result.signer,
    createdAt: new Date().toISOString(),
  });
}

async function handleSignJoin(
  body: Record<string, unknown>,
): Promise<Response> {
  const result = await signJoinPermit(backendSigner, body);

  return jsonResponse(200, {
    domain: {
      ...result.domain,
      chainId: result.domain.chainId.toString(),
    },
    message: joinMessageToJson(result.message),
    signature: result.signature,
    digest: result.digest,
    backendSigner: result.signer,
    createdAt: new Date().toISOString(),
  });
}

async function handleSignHostAndJoin(
  body: Record<string, unknown>,
): Promise<Response> {
  const result = await signHostAndJoinPermit(backendSigner, body);

  return jsonResponse(200, {
    domain: {
      ...result.domain,
      chainId: result.domain.chainId.toString(),
    },
    message: hostAndJoinMessageToJson(result.message),
    signature: result.signature,
    digest: result.digest,
    backendSigner: result.signer,
    createdAt: new Date().toISOString(),
  });
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: withCors(new Headers()),
      });
    }

    const authError = requireApiKey(req, API_KEY);
    if (authError) return authError;

    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return jsonResponse(200, {
        status: "ok",
        service: "evm-permit-server",
        backendSigner: backendSigner.address,
      });
    }

    if (req.method !== "POST") {
      return jsonResponse(404, { error: "Not found" });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    try {
      if (url.pathname === "/evm/permit/host") {
        return await handleSignHost(body);
      }
      if (url.pathname === "/evm/permit/join") {
        return await handleSignJoin(body);
      }
      if (url.pathname === "/evm/permit/host-and-join") {
        return await handleSignHostAndJoin(body);
      }
      return jsonResponse(404, { error: "Not found" });
    } catch (error) {
      return jsonResponse(400, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

console.log(
  JSON.stringify(
    {
      message: "EVM permit server running",
      url: `http://${HOST}:${PORT}`,
      backendSigner: backendSigner.address,
      apiKeyProtected: API_KEY.length > 0,
    },
    null,
    2,
  ),
);
console.log("Endpoints:");
console.log("  GET  /health");
console.log("  POST /evm/permit/host");
console.log("  POST /evm/permit/join");
console.log("  POST /evm/permit/host-and-join");

export default server;
