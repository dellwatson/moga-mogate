export const RAFFLE_ABI = [
  "function unsafeHostRaffle(string raffleId,uint256 totalSlots,uint256 maxSlotsPerAddress,string metadataUri,address collection,bool premintContract,bool premint,uint8 prizeType,uint256 prizeAmount,bool autoDraw,bool autoClaim,uint64 expiresAt) returns (bytes32)",
  "function unsafeJoinRaffle(string raffleId,uint256[] slotIds,uint256 amount,address token) payable",
  "function getRaffleLoadDetail(string raffleId) view returns (uint256 totalSlots,uint256 soldSlots,uint256 maxSlotsPerAddress,string metadataUri,address collection,bool premintContract,bool premint,bool autoDraw,bool autoClaim,uint64 createdAt,uint64 expiresAt,uint8 status,string statusString,uint256 winnerSlot,address winner,uint256 prizeAmount,uint8 prizeType,string prizeTypeString,bool claimed)",
  "function getRaffleResult(string raffleId) view returns (uint256 winnerSlot,address winner,uint8 status,string statusString,bool claimed,address collection,uint256 prizeAmount,uint8 prizeType,string prizeTypeString)",
];
