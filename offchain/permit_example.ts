/**
 * Example script: Generate and sign raffle permits
 * 
 * This demonstrates how the backend issues permits for organizers
 * to create raffles using initialize_raffle_with_permit.
 */

import { PublicKey } from "@solana/web3.js";
import { randomBytes } from "crypto";
import { seedDemoOrganizers, issuePermit, RafflePermitRequest, getOrganizer } from "./organizer_db";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROGRAM_ID = "5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M"; // Devnet program ID

// Note: Backend no longer signs permits; wallets sign the binary message returned.

// ============================================================================
// EXAMPLE: Issue permit for an organizer
// ============================================================================

function main() {
  console.log("🔧 Raffle Permit Example\n");

  // 1. Seed demo organizers (in-memory DB)
  seedDemoOrganizers();
  console.log("");

  // 2. Organizer requests a permit
  const organizerPubkey = "DemoOrg1111111111111111111111111111111111111";
  const profile = getOrganizer(organizerPubkey);
  
  if (!profile) {
    console.error("❌ Organizer not found");
    return;
  }

  console.log(`📋 Organizer Profile:`);
  console.log(`   Enterprise ID: ${profile.enterpriseId}`);
  console.log(`   Tier: ${profile.tier}`);
  console.log(`   Active: ${profile.active}`);
  console.log(`   Allowed Collections: ${profile.allowedCollections.length}`);
  console.log("");

  // 3. Build permit request
  const permitRequest: RafflePermitRequest = {
    organizer: organizerPubkey,
    enterpriseId: profile.enterpriseId,
    nonce: randomBytes(16).toString("hex"), // 16 bytes hex (32 chars)
    expiryUnixTs: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    raffleConfig: {
      requiredTickets: 500n,
      deadlineUnixTs: BigInt(Math.floor(Date.now() / 1000) + 86400 * 7), // 7 days from now
    },
  };

  console.log(`📝 Permit Request:`);
  console.log(`   Organizer: ${permitRequest.organizer}`);
  console.log(`   Enterprise ID: ${permitRequest.enterpriseId}`);
  console.log(`   Nonce: ${permitRequest.nonce}`);
  console.log(`   Expiry: ${new Date(permitRequest.expiryUnixTs * 1000).toISOString()}`);
  console.log(`   Required Tickets: ${permitRequest.raffleConfig.requiredTickets}`);
  console.log(`   Deadline: ${new Date(Number(permitRequest.raffleConfig.deadlineUnixTs) * 1000).toISOString()}`);
  console.log("");

  // 4. Backend issues permit (validates and signs)
  try {
    const { message, nonce } = issuePermit(permitRequest, PROGRAM_ID);

    console.log(`✅ Permit Issued!`);
    console.log(`   Message (hex): ${Buffer.from(message).toString("hex")}`);
    console.log(`   Nonce (hex): ${Buffer.from(nonce).toString("hex")}`);
    console.log("");

    // 5. Frontend signs this message with the organizer wallet (ed25519 signMessage)
    // and uses signature + message + nonce + expiry in createRaffleWithPermitTx()
    console.log(`📤 Frontend Usage:`);
    console.log(`   import { createRaffleWithPermitTx } from "@moga/rwa-raffle-sdk";`);
    console.log(`   const tx = await createRaffleWithPermitTx(conn, {`);
    console.log(`     programId: new PublicKey("${PROGRAM_ID}"),`);
    console.log(`     organizer: new PublicKey("${permitRequest.organizer}"),`);
    console.log(`     escrowMint: usdcMint,`);
    console.log(`     escrowAta,`);
    console.log(`     requiredTickets: ${permitRequest.raffleConfig.requiredTickets}n,`);
    console.log(`     deadlineUnixTs: ${permitRequest.raffleConfig.deadlineUnixTs}n,`);
    console.log(`     permitMessage: Buffer.from("${Buffer.from(message).toString("hex")}", "hex"),`);
    console.log(`     permitSignature: Buffer.from("<wallet_signature_hex>", "hex"), // signMessage(permitMessage)`);
    console.log(`     permitNonce: Buffer.from("${Buffer.from(nonce).toString("hex")}", "hex"),`);
    console.log(`     permitExpiryUnixTs: ${permitRequest.expiryUnixTs}n,`);
    console.log(`     autoDraw: true,`);
    console.log(`     ticketMode: 1, // 0=disabled, 1=require_burn, 2=accept_without_burn`);
    console.log(`   });`);
    console.log("");

  } catch (error) {
    console.error(`❌ Permit issuance failed: ${error}`);
  }
}

main();
