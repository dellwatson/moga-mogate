export const RAFFLE_TEE_ABI = [
  "function createRaffle(string raffleId,uint256 totalSlots,uint256 maxTicketsPerAddress,uint256 ticketPriceWei,string metadataUri,address collection,bool premintContract,bool premint,uint8 prizeType,uint256 prizeAmount,bool autoClaim,uint64 expiresAt,uint8 privacy) returns (bytes32)",
  "function joinSlotsOnly(string raffleId,bytes32[] commitments) payable",
  "function commitTicketsRoot(string raffleId,bytes32 ticketsRoot,uint256 soldTickets)",
  "function registerDrawCall(string raffleId,bytes32 callId)",
  "function markReadyForDraw(string raffleId)",
  "function getRaffle(string raffleId) view returns (string outRaffleId,address organizer,uint256 totalSlots,uint256 soldTickets,uint256 maxTicketsPerAddress,uint256 ticketPriceWei,uint8 privacy,uint8 status,address collection,uint256 prizeAmount,uint8 prizeType,bool autoClaim,uint64 createdAt,uint64 expiresAt,address winner,uint256 winnerIndex,bytes32 ticketsRoot,bool claimed)",
];
