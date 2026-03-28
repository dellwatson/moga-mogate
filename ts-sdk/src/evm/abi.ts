export const RAFFLE_ABI = [
  "function hostRaffle(string raffleId,uint256 totalSlots,uint256 maxSlotsPerAddress,string metadataUri,address collection,bool premintContract,bool premint,uint8 prizeType,uint256 prizeAmount,bool autoDraw,bool autoClaim,uint64 expiresAt,bytes signature) returns (bytes32)",
  "function joinRaffle(string raffleId,uint256[] slotIds,uint256 amount,address token,bytes signature) payable",
  "function hostAndJoinRaffle(string raffleId,uint256 totalSlots,uint256 maxSlotsPerAddress,string metadataUri,address collection,bool premintContract,bool premint,uint8 prizeType,uint256 prizeAmount,bool autoDraw,bool autoClaim,uint64 expiresAt,uint256[] slotIds,uint256 amount,address token,uint256 bonusFreeSlots,bytes signature) payable returns (bytes32)",
  "function unsafeHostRaffle(string raffleId,uint256 totalSlots,uint256 maxSlotsPerAddress,string metadataUri,address collection,bool premintContract,bool premint,uint8 prizeType,uint256 prizeAmount,bool autoDraw,bool autoClaim,uint64 expiresAt) returns (bytes32)",
  "function unsafeJoinRaffle(string raffleId,uint256[] slotIds,uint256 amount,address token) payable",
  "function backendSigner() view returns (address)",
  "function setBackendSigner(address signer)",
  "function usedPermits(bytes32) view returns (bool)",
  "function getRaffleLoadDetail(string raffleId) view returns (uint256 totalSlots,uint256 soldSlots,uint256 maxSlotsPerAddress,string metadataUri,address collection,bool premintContract,bool premint,bool autoDraw,bool autoClaim,uint64 createdAt,uint64 expiresAt,uint8 status,string statusString,uint256 winnerSlot,address winner,uint256 prizeAmount,uint8 prizeType,string prizeTypeString,bool claimed)",
  "function getRaffleResult(string raffleId) view returns (uint256 winnerSlot,address winner,uint8 status,string statusString,bool claimed,address collection,uint256 prizeAmount,uint8 prizeType,string prizeTypeString)",
];
