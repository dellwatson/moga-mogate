/**
 * EIP-712 Constants for Raffle Permits
 */

export const RAFFLE_EIP712_DOMAIN = {
  name: "MogateRaffle",
  version: "1",
} as const;

export const HOST_RAFFLE_TYPES = {
  HostRaffle: [
    { name: "raffleId", type: "string" },
    { name: "totalSlots", type: "uint256" },
    { name: "maxSlotsPerAddress", type: "uint256" },
    { name: "metadataUri", type: "string" },
    { name: "collection", type: "address" },
    { name: "premintContract", type: "bool" },
    { name: "premint", type: "bool" },
    { name: "prizeType", type: "uint8" },
    { name: "prizeAmount", type: "uint256" },
    { name: "autoDraw", type: "bool" },
    { name: "autoClaim", type: "bool" },
    { name: "expiresAt", type: "uint64" },
    { name: "organizer", type: "address" },
  ],
} as const;

export const JOIN_RAFFLE_TYPES = {
  JoinRaffle: [
    { name: "raffleId", type: "string" },
    { name: "slotIds", type: "uint256[]" },
    { name: "amount", type: "uint256" },
    { name: "token", type: "address" },
    { name: "payer", type: "address" },
  ],
} as const;

export const HOST_AND_JOIN_RAFFLE_TYPES = {
  HostAndJoinRaffle: [
    { name: "raffleId", type: "string" },
    { name: "totalSlots", type: "uint256" },
    { name: "maxSlotsPerAddress", type: "uint256" },
    { name: "metadataUri", type: "string" },
    { name: "collection", type: "address" },
    { name: "premintContract", type: "bool" },
    { name: "premint", type: "bool" },
    { name: "prizeType", type: "uint8" },
    { name: "prizeAmount", type: "uint256" },
    { name: "autoDraw", type: "bool" },
    { name: "autoClaim", type: "bool" },
    { name: "expiresAt", type: "uint64" },
    { name: "slotIds", type: "uint256[]" },
    { name: "amount", type: "uint256" },
    { name: "token", type: "address" },
    { name: "bonusFreeSlots", type: "uint256" },
    { name: "payer", type: "address" },
  ],
} as const;
