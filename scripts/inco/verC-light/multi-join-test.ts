/**
 * Multi-Join Test for verC-light
 *
 * Tests multiple accounts joining the same raffle to demonstrate multi-ticket capability
 * Each account can only join once per raffle due to PDA structure
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
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
const CONFIG_SEED = Buffer.from("config");
const RAFFLE_SEED = Buffer.from("raffle");
const SLOTS_SEED = Buffer.from("slots");
const TREASURY_SEED = Buffer.from("treasury");
const USER_SEED = Buffer.from("user");

// Derive PDAs
function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
}

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

function deriveUserRafflePda(
  raffle: PublicKey,
  user: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_SEED, raffle.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );
}

// Config discriminator: first 8 bytes of sha256("global:initialize_config")
function serializeInitializeConfigData(refundFeeBps: number): Buffer {
  const buffer = Buffer.alloc(100);
  let offset = 0;

  const discriminator = createHash("sha256")
    .update("global:initialize_config")
    .digest()
    .slice(0, 8);
  discriminator.copy(buffer, offset);
  offset += 8;

  buffer.writeUInt16LE(refundFeeBps, offset);
  offset += 2;

  return buffer.slice(0, offset);
}

// Join instruction data serializer (auto-assigned numbers)
function serializeJoinRaffleData(
  amount: number,
  encryptedGuess: Uint8Array,
): Buffer {
  const buffer = Buffer.alloc(1000);
  let offset = 0;

  // Anchor discriminator: first 8 bytes of sha256("global:unsafe_join_raffle")
  const discriminator = createHash("sha256")
    .update("global:unsafe_join_raffle")
    .digest()
    .slice(0, 8);
  discriminator.copy(buffer, offset);
  offset += 8;

  // Amount (u64)
  buffer.writeBigUInt64LE(BigInt(amount), offset);
  offset += 8;

  // Encrypted guess (vector)
  buffer.writeUInt32LE(encryptedGuess.length, offset);
  offset += 4;
  encryptedGuess.copy(buffer, offset);

  return buffer.slice(0, offset + encryptedGuess.length);
}

// Create multiple test wallets
function createTestWallets(count: number): Keypair[] {
  const wallets: Keypair[] = [];
  for (let i = 0; i < count; i++) {
    wallets.push(Keypair.generate());
  }
  return wallets;
}

// Main function
async function main() {
  console.log(
    "🎯 Multi-Join test for verC-light (Multiple Accounts + Auto-Assigned Numbers)",
  );

  const connection = new Connection(RPC_URL, "confirmed");
  const mainWallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))),
  );

  // Read existing raffle
  const raffleTest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "test-result.json"), "utf8"),
  );

  // Create 3 test wallets
  const testWallets = createTestWallets(3);
  console.log(`👥 Created ${testWallets.length} test wallets`);

  // Fund test wallets from main wallet
  console.log(`💰 Funding test wallets...`);
  for (let i = 0; i < testWallets.length; i++) {
    const fundAmount = 0.2 * LAMPORTS_PER_SOL; // 0.2 SOL each
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: mainWallet.publicKey,
        toPubkey: testWallets[i].publicKey,
        lamports: fundAmount,
      }),
    );

    await sendAndConfirmTransaction(connection, fundTx, [mainWallet]);
    console.log(
      `  Wallet ${i + 1}: ${testWallets[i].publicKey.toString()} - Funded 0.2 SOL`,
    );
  }

  // Join raffle with each test wallet
  const joinResults = [];
  const amount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL per ticket
  const encryptedGuess = Buffer.from("placeholder-encrypted-guess-32-bytes");

  try {
    // Derive PDAs
    const [configPda] = deriveConfigPda();
    const rafflePda = new PublicKey(raffleTest.rafflePda);
    const slotsPda = new PublicKey(raffleTest.slotsPda);
    const treasuryPda = new PublicKey(raffleTest.treasuryPda);

    for (let i = 0; i < testWallets.length; i++) {
      const wallet = testWallets[i];
      const [userRafflePda] = deriveUserRafflePda(rafflePda, wallet.publicKey);

      console.log(`\n🎫 Wallet ${i + 1} joining raffle...`);
      console.log(`  👤 User: ${wallet.publicKey.toString()}`);
      console.log(`  🎟️  User Raffle PDA: ${userRafflePda.toString()}`);

      // Create join instruction
      const instructionData = serializeJoinRaffleData(amount, encryptedGuess);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer
          { pubkey: configPda, isSigner: false, isWritable: false }, // config
          { pubkey: rafflePda, isSigner: false, isWritable: true }, // raffle
          { pubkey: slotsPda, isSigner: false, isWritable: true }, // slots
          { pubkey: userRafflePda, isSigner: false, isWritable: true }, // userRaffle
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          }, // light_state_tree placeholder
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          }, // light_system_program placeholder
          { pubkey: treasuryPda, isSigner: false, isWritable: true }, // treasury
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          }, // system_program
          {
            pubkey: new PublicKey(
              "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj",
            ),
            isSigner: false,
            isWritable: false,
          }, // inco_lightning_program
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);

      console.log(
        `  💰 Balance: ${await connection.getBalance(wallet.publicKey)} lamports`,
      );
      console.log(`  📤 Sending join transaction...`);

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet],
        { commitment: "confirmed" },
      );

      console.log(`  ✅ Wallet ${i + 1} joined successfully!`);
      console.log(
        `  🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      );

      joinResults.push({
        walletIndex: i + 1,
        userPublicKey: wallet.publicKey.toString(),
        userRafflePda: userRafflePda.toString(),
        amount,
        signature,
        timestamp: Date.now(),
      });
    }

    // Save results
    const result = {
      success: true,
      raffleId: raffleTest.raffleId,
      totalTickets: joinResults.length,
      joinResults,
      timestamp: Date.now(),
    };

    fs.writeFileSync(
      path.join(__dirname, "multi-join-result.json"),
      JSON.stringify(result, null, 2),
    );

    console.log(`\n🎉 Multi-join test completed!`);
    console.log(`📊 Total tickets purchased: ${joinResults.length}`);
    console.log(`💾 Results saved to multi-join-result.json`);

    console.log(`\n🔍 Privacy Analysis:`);
    console.log(`❌ What we CAN see:`);
    console.log(`  • Who joined (wallet addresses)`);
    console.log(`  • When they joined (timestamps)`);
    console.log(`  • How much they paid (0.1 SOL each)`);
    console.log(`  • Transaction signatures`);

    console.log(`\n🔒 What we CAN'T see (FHE Privacy):`);
    console.log(`  • Auto-assigned numbers (encrypted)`);
    console.log(`  • Encrypted guesses`);
    console.log(`  • Winning number until draw`);
    console.log(`  • Who has which number`);
  } catch (error) {
    console.error(`❌ Multi-join test failed:`, error);
  }
}

main().catch(console.error);
