/**
 * Example: Create a host raffle permit
 * This demonstrates how to use the modular ts-sdk to create permits
 */

import * as dotenv from "dotenv";
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signHostRafflePermit,
  hashHostRafflePermit,
  PrizeTokenType,
  type HostRafflePermit,
} from "../../ts-sdk/src/evm/index.ts";

dotenv.config();

async function main() {
  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const BACKEND_PRIVATE_KEY =
    process.env.BACKEND_SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY_ETH;

  if (!BACKEND_PRIVATE_KEY) {
    throw new Error(
      "Missing BACKEND_SIGNER_PRIVATE_KEY or PRIVATE_KEY_ETH environment variable",
    );
  }

  const CHAIN_ID = BigInt(process.env.CHAIN_ID || "11155111"); // Sepolia
  const RAFFLE_ADDRESS =
    process.env.RAFFLE_ADDRESS || "0x0000000000000000000000000000000000000000";

  // ============================================================================
  // CREATE SIGNER
  // ============================================================================

  const backendSigner = createSignerFromPrivateKey(BACKEND_PRIVATE_KEY);
  const signerAddress = await backendSigner.getAddress();
  console.log("Backend signer:", signerAddress);

  const ORGANIZER_ADDRESS = process.env.ORGANIZER_ADDRESS || signerAddress;

  // ============================================================================
  // RAFFLE PARAMETERS
  // ============================================================================

  const raffleParams: HostRafflePermit = {
    raffleId: `raffle-${Date.now()}`,
    totalSlots: 100n,
    maxSlotsPerAddress: 5n,
    metadataUri: "https://example.com/raffle/metadata.json",
    collection:
      process.env.COLLECTION_ADDRESS ||
      "0x0000000000000000000000000000000000000000",
    premintContract: false,
    premint: false,
    prizeType: PrizeTokenType.ERC721,
    prizeAmount: 1n,
    autoDraw: true,
    autoClaim: false,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours
    organizer: ORGANIZER_ADDRESS,
  };

  // ============================================================================
  // BUILD DOMAIN
  // ============================================================================

  const domain = buildRaffleDomain(CHAIN_ID, RAFFLE_ADDRESS);
  console.log("\nDomain:", {
    name: domain.name,
    version: domain.version,
    chainId: domain.chainId.toString(),
    verifyingContract: domain.verifyingContract,
  });

  // ============================================================================
  // SIGN PERMIT
  // ============================================================================

  console.log("\nSigning permit...");
  const signature = await signHostRafflePermit(
    backendSigner,
    domain,
    raffleParams,
  );
  const digest = hashHostRafflePermit(domain, raffleParams);

  // ============================================================================
  // OUTPUT
  // ============================================================================

  const output = {
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId.toString(),
      verifyingContract: domain.verifyingContract,
    },
    message: {
      raffleId: raffleParams.raffleId,
      totalSlots: raffleParams.totalSlots.toString(),
      maxSlotsPerAddress: raffleParams.maxSlotsPerAddress.toString(),
      metadataUri: raffleParams.metadataUri,
      collection: raffleParams.collection,
      premintContract: raffleParams.premintContract,
      premint: raffleParams.premint,
      prizeType: raffleParams.prizeType,
      prizeAmount: raffleParams.prizeAmount.toString(),
      autoDraw: raffleParams.autoDraw,
      autoClaim: raffleParams.autoClaim,
      expiresAt: raffleParams.expiresAt.toString(),
      organizer: raffleParams.organizer,
    },
    signature,
    digest,
    backendSigner: await backendSigner.getAddress(),
    createdAt: new Date().toISOString(),
  };

  console.log("\n✅ Permit created successfully!");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
