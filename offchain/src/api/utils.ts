/**
 * API utilities for request/response handling
 */

import type {
  HostRafflePermit,
  JoinRafflePermit,
  HostAndJoinRafflePermit,
} from "../../../../ts-sdk/src/evm/index.ts";

export function withCors(headers: Headers): Headers {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return headers;
}

export function jsonResponse(status: number, body: unknown): Response {
  const headers = withCors(new Headers());
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

export function requireApiKey(req: Request, apiKey: string): Response | null {
  if (!apiKey) return null;
  const key = req.headers.get("x-api-key") || "";
  if (key !== apiKey) {
    return jsonResponse(401, { error: "Unauthorized: invalid API key" });
  }
  return null;
}

export function hostMessageToJson(message: HostRafflePermit) {
  return {
    raffleId: message.raffleId,
    totalSlots: message.totalSlots.toString(),
    maxSlotsPerAddress: message.maxSlotsPerAddress.toString(),
    metadataUri: message.metadataUri,
    collection: message.collection,
    premintContract: message.premintContract,
    premint: message.premint,
    prizeType: Number(message.prizeType),
    prizeAmount: message.prizeAmount.toString(),
    autoDraw: message.autoDraw,
    autoClaim: message.autoClaim,
    expiresAt: message.expiresAt.toString(),
    organizer: message.organizer,
  };
}

export function joinMessageToJson(message: JoinRafflePermit) {
  return {
    raffleId: message.raffleId,
    slotIds: message.slotIds.map((s) => s.toString()),
    amount: message.amount.toString(),
    token: message.token,
    payer: message.payer,
  };
}

export function hostAndJoinMessageToJson(message: HostAndJoinRafflePermit) {
  return {
    raffleId: message.raffleId,
    totalSlots: message.totalSlots.toString(),
    maxSlotsPerAddress: message.maxSlotsPerAddress.toString(),
    metadataUri: message.metadataUri,
    collection: message.collection,
    premintContract: message.premintContract,
    premint: message.premint,
    prizeType: Number(message.prizeType),
    prizeAmount: message.prizeAmount.toString(),
    autoDraw: message.autoDraw,
    autoClaim: message.autoClaim,
    expiresAt: message.expiresAt.toString(),
    slotIds: message.slotIds.map((s) => s.toString()),
    amount: message.amount.toString(),
    token: message.token,
    bonusFreeSlots: message.bonusFreeSlots.toString(),
    payer: message.payer,
  };
}
