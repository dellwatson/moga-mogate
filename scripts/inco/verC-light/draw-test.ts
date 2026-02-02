/**
 * Draw Winner Test for verC-light
 *
 * Tests the draw_winner functionality to demonstrate FHE privacy features
 * Shows what information is visible vs encrypted during winner selection
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// Program ID for multi_raffle-inco-C-light
const PROGRAM_ID = new PublicKey(
  "FETxRpn16JkFzBm8Fwoi1RXapP6uGvScM3jJ5sdjEKHp",
);

// Network config
const RPC_URL = "https://api.devnet.solana.com";
const WALLET_PATH = path.join(
  process.env.HOME || "~",
  ".config/solana/id.json",
);

// Seeds
const RAFFLE_SEED = Buffer.from("raffle");
const SLOTS_SEED = Buffer.from("slots");
const TREASURY_SEED = Buffer.from("treasury");

// Derive PDAs
function deriveRafflePda(raffleId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [RAFFLE_SEED, Buffer.from(raffleId)],
    PROGRAM_ID,
  );
}

function deriveSlotsPda(raffle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SLOTS_SEED, raffle.toBuffer()],
    PROGRAM_ID,
  );
}

function deriveTreasuryPda(raffle: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, raffle.toBuffer()],
    PROGRAM_ID,
  );
}

// Draw winner instruction data serializer
function serializeDrawWinnerData(): Buffer {
  const buffer = Buffer.alloc(100);
  let offset = 0;

  // Anchor discriminator: first 8 bytes of sha256("global:draw_winner")
  const discriminator = createHash("sha256")
    .update("global:draw_winner")
    .digest()
    .slice(0, 8);
  discriminator.copy(buffer, offset);
  offset += 8;

  return buffer.slice(0, offset);
}

// Main function
async function main() {
  console.log("🎯 Draw Winner test for verC-light (FHE Privacy Demonstration)");

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))),
  );

  // Read existing raffle and multi-join results
  const raffleTest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "test-result.json"), "utf8"),
  );

  const multiJoinResult = JSON.parse(
    fs.readFileSync(path.join(__dirname, "multi-join-result.json"), "utf8"),
  );

  console.log(`📋 Raffle: ${raffleTest.raffleId}`);
  console.log(`🎫 Total participants: ${multiJoinResult.totalTickets}`);
  console.log(`👤 Authority: ${wallet.publicKey.toString()}`);

  try {
    // Derive PDAs
    const rafflePda = new PublicKey(raffleTest.rafflePda);
    const slotsPda = new PublicKey(raffleTest.slotsPda);
    const treasuryPda = new PublicKey(raffleTest.treasuryPda);

    console.log(`\n🔍 Pre-Draw Analysis:`);
    console.log(`❌ What we CAN see:`);
    console.log(`  • Raffle account: ${rafflePda.toString()}`);
    console.log(
      `  • Treasury balance: ${await connection.getBalance(treasuryPda)} lamports`,
    );
    console.log(`  • Participants: ${multiJoinResult.totalTickets} wallets`);

    console.log(`\n🔒 What we CAN'T see (FHE Encrypted):`);
    console.log(`  • Auto-assigned numbers for each participant`);
    console.log(`  • Encrypted guesses from each participant`);
    console.log(`  • Winning number (not yet determined)`);

    // Create draw instruction
    const instructionData = serializeDrawWinnerData();

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // authority
        { pubkey: rafflePda, isSigner: false, isWritable: true }, // raffle
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);

    console.log(`\n🎲 Drawing winner...`);
    console.log(`📤 Sending draw transaction...`);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: "confirmed" },
    );

    console.log(`✅ Winner drawn successfully!`);
    console.log(
      `🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    );

    // Post-draw analysis
    console.log(`\n🔍 Post-Draw Analysis:`);

    // Get updated raffle account to see changes
    const raffleAccount = await connection.getAccountInfo(rafflePda);
    console.log(`📊 Raffle account size: ${raffleAccount.data.length} bytes`);

    const treasuryBalance = await connection.getBalance(treasuryPda);
    console.log(`💰 Treasury balance after draw: ${treasuryBalance} lamports`);

    console.log(`\n🔒 Still PRIVATE (FHE Encrypted):`);
    console.log(`  • Winning number (encrypted handle)`);
    console.log(`  • Which participant won (until claim)`);
    console.log(`  • Individual encrypted guesses`);

    console.log(`\n❌ Now PUBLIC:`);
    console.log(`  • Draw transaction occurred`);
    console.log(`  • Treasury balance changed`);
    console.log(`  • Raffle status updated`);

    // Save draw result
    const result = {
      success: true,
      raffleId: raffleTest.raffleId,
      drawSignature: signature,
      treasuryBalance,
      participantsCount: multiJoinResult.totalTickets,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "draw-result.json"),
      JSON.stringify(result, null, 2),
    );

    console.log(`\n💾 Draw result saved to draw-result.json`);

    console.log(`\n🎯 Next Steps:`);
    console.log(`1. Winner needs to check_winner() to see if they won`);
    console.log(`2. Winner claims prize via withdraw_prize()`);
    console.log(`3. Only winner knows their assigned number (FHE privacy)`);
  } catch (error) {
    console.error(`❌ Draw test failed:`, error);
  }
}

main().catch(console.error);
