/**
 * Example: Create a join raffle permit
 * This demonstrates how to use the modular ts-sdk to create permits
 */

import * as dotenv from "dotenv";
import { ethers } from "ethers";
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signJoinRafflePermit,
  hashJoinRafflePermit,
  type JoinRafflePermit,
} from "../../ts-sdk/src/evm/index.ts";

dotenv.config();

async function main() {
  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const BACKEND_PRIVATE_KEY =
    process.env.BACKEND_SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY_ETH!;
  const CHAIN_ID = BigInt(process.env.CHAIN_ID || "11155111"); // Sepolia
  const RAFFLE_ADDRESS = process.env.RAFFLE_ADDRESS!;
  const PAYER_ADDRESS = process.env.PAYER_ADDRESS!;
  const RAFFLE_ID = process.env.RAFFLE_ID || "raffle-123";

  // ============================================================================
  // JOIN PARAMETERS
  // ============================================================================

  const joinParams: JoinRafflePermit = {
    raffleId: RAFFLE_ID,
    slotIds: [1n, 2n, 3n], // Slots to purchase
    amount: ethers.parseEther("0.05"), // 0.05 ETH
    token: ethers.ZeroAddress, // Native token (ETH)
    payer: PAYER_ADDRESS,
  };

  // ============================================================================
  // CREATE SIGNER
  // ============================================================================

  const backendSigner = createSignerFromPrivateKey(BACKEND_PRIVATE_KEY);
  console.log("Backend signer:", await backendSigner.getAddress());

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
  const signature = await signJoinRafflePermit(
    backendSigner,
    domain,
    joinParams,
  );
  const digest = hashJoinRafflePermit(domain, joinParams);

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
      raffleId: joinParams.raffleId,
      slotIds: joinParams.slotIds.map((s) => s.toString()),
      amount: joinParams.amount.toString(),
      token: joinParams.token,
      payer: joinParams.payer,
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
