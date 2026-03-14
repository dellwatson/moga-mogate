// Optional local override. If a field is set here, it wins.
// If left empty, the script falls back to CLI args, then defaults.
const INPUT = {
  // Programs (optional). Leave empty to use ts-sdk defaults.
  raffleProgram: "mogate_darkpool_raffle_priv_v3.aleo",
  arc721Program: "mogate_arc721_multiprivate_v2",

  // Raffle config
  raffleId: "1", // numeric (will normalize to 1field)
  collectionId: "", // default from scripts/setup/setup.config.ts
  totalSlots: "", // default: 200
  maxSlotsPerUser: "", // default: 0 (no limit)
  metadataHash: "0field",

  // Random seed for draw_raffle. Must be the SAME value used later in 07_draw.ts.
  // Leave empty to default to unix timestamp seconds (demo only).
  seed: "",

  // Prize metadata (must be the SAME value used later in 08_claim.ts)
  metadataBaseUrl: "",
  metadataUrl: "",
  data: "",
  dataFile: "",
  edition: "", // default: 1
  autoDraw: undefined as boolean | undefined,
  autoClaim: undefined as boolean | undefined,
  privateFee: undefined as boolean | undefined,
};
