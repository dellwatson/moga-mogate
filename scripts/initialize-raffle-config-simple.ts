/**
 * Initialize Multi-Raffle Config (Simple Version)
 *
 * Uses raw transaction instead of Anchor client to avoid IDL issues
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

// Configuration
const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL =
  NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME!, ".config/solana/id.json");
const REFUND_FEE_BPS = parseInt(process.env.REFUND_FEE_BPS || "500"); // 5% default

// Multi-Raffle Program ID
const PROGRAM_ID = new PublicKey(
  "2qaxQY3shNquV8STxFPoJW6bL9FUAEzUqinZSP163znG",
);

// Instruction discriminator for initialize_config (from IDL)
const INITIALIZE_CONFIG_DISCRIMINATOR = Buffer.from([
  208, 127, 21, 1, 194, 190, 196, 70,
]);

async function main() {
  console.log("🎰 Initializing Multi-Raffle Configuration (Simple)");
  console.log("===============================================\n");

  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))),
  );

  console.log("Network:", NETWORK);
  console.log("Your Wallet:", walletKeypair.publicKey.toBase58());
  console.log("Refund Fee BPS:", REFUND_FEE_BPS, `(${REFUND_FEE_BPS / 100}%)`);

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID,
  );

  console.log("\n📍 Config PDA:", configPda.toBase58());
  console.log("   Bump:", configBump);

  // Check if config already exists
  try {
    const accountInfo = await connection.getAccountInfo(configPda);
    if (accountInfo && accountInfo.owner.equals(PROGRAM_ID)) {
      console.log("\n⚠️  Config already initialized!");

      // Parse the account data (Config struct: 8 bytes discriminator + 32 bytes admin + 2 bytes refund_fee_bps)
      if (accountInfo.data.length >= 42) {
        const adminPubkey = new PublicKey(accountInfo.data.slice(8, 40));
        const refundFeeBps = accountInfo.data.readUInt16LE(40);

        console.log("   Admin:", adminPubkey.toBase58());
        console.log(
          "   Refund Fee BPS:",
          refundFeeBps,
          `(${refundFeeBps / 100}%)`,
        );

        if (adminPubkey.equals(walletKeypair.publicKey)) {
          console.log("\n✅ You are the admin!");
        } else {
          console.log("\n❌ You are NOT the admin!");
          console.log("   Someone else initialized the config first.");
        }
      }

      console.log("\n💡 Config is already set up. No action needed.");
      return;
    }
  } catch (err) {
    // Account doesn't exist, proceed
  }

  console.log("\n✅ Config not initialized yet, proceeding...");
  console.log("   You will become the admin!");

  try {
    // Create instruction
    const instruction = {
      keys: [
        {
          pubkey: walletKeypair.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: configPda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: PROGRAM_ID,
      data: Buffer.concat([
        INITIALIZE_CONFIG_DISCRIMINATOR,
        Buffer.alloc(2), // refund_fee_bps (2 bytes, little endian)
      ]),
    };

    // Set refund fee in instruction data
    instruction.data.writeUInt16LE(REFUND_FEE_BPS, 8);

    // Create transaction
    const transaction = new Transaction().add(instruction);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletKeypair.publicKey;

    // Sign and send
    transaction.sign(walletKeypair);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      },
    );

    console.log("✅ Config initialized!");
    console.log("   Transaction:", signature);
    console.log(
      `   Explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`,
    );

    // Wait for confirmation
    await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed",
    );

    // Verify
    const accountInfo = await connection.getAccountInfo(configPda);
    if (accountInfo && accountInfo.data.length >= 42) {
      const adminPubkey = new PublicKey(accountInfo.data.slice(8, 40));
      const refundFeeBps = accountInfo.data.readUInt16LE(40);

      console.log("\n📋 Raffle Configuration:");
      console.log("   Admin:", adminPubkey.toBase58());
      console.log(
        "   Refund Fee BPS:",
        refundFeeBps,
        `(${refundFeeBps / 100}%)`,
      );

      // Save config info
      const configInfo = {
        network: NETWORK,
        programId: PROGRAM_ID.toBase58(),
        configPda: configPda.toBase58(),
        admin: adminPubkey.toBase58(),
        refundFeeBps: refundFeeBps,
        refundFeePercentage: refundFeeBps / 100,
        initializedAt: new Date().toISOString(),
        transaction: signature,
      };

      const outputPath = path.join(
        __dirname,
        `../.raffle-config-${NETWORK}.json`,
      );
      fs.writeFileSync(outputPath, JSON.stringify(configInfo, null, 2));
      console.log("\n💾 Config saved to:", outputPath);
    }

    console.log("\n✨ Setup complete!");
    console.log("\n🎉 You are now the admin!");
    console.log("\n📝 As admin, you can:");
    console.log("   1. Create raffles (unsafe_host_raffle)");
    console.log("   2. Withdraw proceeds from any raffle (withdraw_proceeds)");
    console.log("   3. Update refund fee (set_refund_fee_bps)");
  } catch (error: any) {
    console.error("\n❌ Error initializing config:");
    console.error(error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
