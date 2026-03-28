/**
 * Utility functions for raffle operations
 */

import { ethers } from "ethers";
import type { RaffleLoadReport, RaffleResultReport } from "./types.ts";

/**
 * Parse raffle load detail from contract response
 */
export function parseRaffleLoadDetail(load: any[]): RaffleLoadReport {
  return {
    totalSlots: load[0].toString(),
    soldSlots: load[1].toString(),
    maxSlotsPerAddress: load[2].toString(),
    metadataUri: load[3],
    collection: load[4],
    premintContract: load[5],
    premint: load[6],
    autoDraw: load[7],
    autoClaim: load[8],
    createdAt: Number(load[9]),
    expiresAt: Number(load[10]),
    status: load[11],
    statusString: load[12],
    winnerSlot: load[13].toString(),
    winner: load[14],
    prizeAmount: load[15].toString(),
    prizeType: load[16],
    prizeTypeString: load[17],
    claimed: load[18],
  };
}

/**
 * Parse raffle result from contract response
 */
export function parseRaffleResult(result: any[]): RaffleResultReport {
  return {
    winnerSlot: result[0].toString(),
    winner: result[1],
    status: result[2],
    statusString: result[3],
    claimed: result[4],
    collection: result[5],
    prizeAmount: result[6].toString(),
    prizeType: result[7],
    prizeTypeString: result[8],
  };
}

/**
 * Generate raffle bytes ID from string ID
 */
export function getRaffleBytesId(raffleId: string): string {
  return ethers.id(raffleId);
}
