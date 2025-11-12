/**
 * Withdraw Platform Fees
 * 
 * This script allows the authority to withdraw accumulated fees
 * from the fee wallet to a destination wallet.
 * 
 * Usage:
 *   # Withdraw all fees
 *   PAYMENT_MINT=<usdc_mint> bun run scripts/fee-admin/3-withdraw-fees.ts
 * 
 *   # Withdraw specific amount
 *   PAYMENT_MINT=<usdc_mint> AMOUNT=100 bun run scripts/fee-admin/3-withdraw-fees.ts
 * 
 *   # Withdraw to different wallet
 *   PAYMENT_MINT=<usdc_mint> DESTINATION=<wallet> bun run scripts/fee-admin/3-withdraw-fees.ts
 * 
 * Environment Variables:
 *   SOLANA_NETWORK - devnet or mainnet (default: devnet)
 *   SOLANA_RPC_URL - Custom RPC endpoint (optional)
 *   WALLET_PATH - Path to authority wallet (default: ~/.config/solana/id.json)
 *   FEE_WALLET_PATH - Path to fee wallet keypair (if different from authority)
 *   PAYMENT_MINT - Payment token mint address (REQUIRED)
 *   AMOUNT - Amount to withdraw in tokens (optional, withdraws all if not specified)
 *   DESTINATION - Destination wallet address (optional, defaults to authority)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import path from "path";

// ============================================================================
// Configuration
// ============================================================================

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME!, ".config/solana/id.json");

const FEE_WALLET_PATH = process.env.FEE_WALLET_PATH || WALLET_PATH;

// Withdrawal parameters
const PAYMENT_MINT = process.env.PAYMENT_MINT;
const AMOUNT = process.env.AMOUNT ? parseFloat(process.env.AMOUNT) : null;
const DESTINATION = process.env.DESTINATION;

// Program ID
const PROGRAM_ID = new PublicKey(
  "DE9rqqvye7rExak5cjYdkBup5wR9PRYMrbZw17xPooCt"
);

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log("💰 Withdrawing Platform Fees");
  console.log("=============================\n");

  // Validate inputs
  if (!PAYMENT_MINT) {
    console.log("❌ PAYMENT_MINT is required!");
    console.log("\nUsage:");
    console.log("  PAYMENT_MINT=<mint_address> bun run scripts/fee-admin/3-withdraw-fees.ts");
    console.log("\nExamples:");
    console.log("  # USDC on devnet");
    console.log("  PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/3-withdraw-fees.ts");
    console.log("\n  # Withdraw specific amount");
    console.log("  PAYMENT_MINT=<mint> AMOUNT=100 bun run scripts/fee-admin/3-withdraw-fees.ts");
    process.exit(1);
  }

  const paymentMint = new PublicKey(PAYMENT_MINT);

  // Load authority wallet
  const authorityKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
  );

  // Load fee wallet (might be same as authority)
  const feeWalletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(FEE_WALLET_PATH, "utf-8")))
  );

  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log("Authority:", authorityKeypair.publicKey.toBase58());
  console.log("Fee Wallet:", feeWalletKeypair.publicKey.toBase58());
  console.log("Payment Mint:", paymentMint.toBase58());

  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(authorityKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program IDL
  const idlPath = path.join(
    __dirname,
    "../../target/idl/direct_sell_anchor.json"
  );
  
  let idl;
  if (fs.existsSync(idlPath)) {
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  } else {
    console.log("⚠️  IDL not found, fetching from chain...");
    idl = await Program.fetchIdl(PROGRAM_ID, provider);
    if (!idl) {
      throw new Error("Could not fetch IDL from chain");
    }
  }

  const program = new Program(idl, PROGRAM_ID, provider);

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  // Fetch config
  let config;
  try {
    config = await program.account.platformConfig.fetch(configPda);
  } catch (err) {
    console.error("\n❌ Config not initialized!");
    console.log("Run: bun run scripts/fee-admin/1-initialize-config.ts");
    process.exit(1);
  }

  // Verify authority
  if (!config.authority.equals(authorityKeypair.publicKey)) {
    console.error("\n❌ Unauthorized!");
    console.log("   Current authority:", config.authority.toBase58());
    console.log("   Your wallet:", authorityKeypair.publicKey.toBase58());
    process.exit(1);
  }

  // Verify fee wallet matches
  if (!config.feeWallet.equals(feeWalletKeypair.publicKey)) {
    console.error("\n❌ Fee wallet mismatch!");
    console.log("   Config fee wallet:", config.feeWallet.toBase58());
    console.log("   Provided fee wallet:", feeWalletKeypair.publicKey.toBase58());
    console.log("\n💡 Set FEE_WALLET_PATH to the correct keypair file");
    process.exit(1);
  }

  // Get token accounts
  const feeWalletAta = await getAssociatedTokenAddress(
    paymentMint,
    feeWalletKeypair.publicKey
  );

  const destinationPubkey = DESTINATION
    ? new PublicKey(DESTINATION)
    : authorityKeypair.publicKey;

  const destinationAta = await getAssociatedTokenAddress(
    paymentMint,
    destinationPubkey
  );

  console.log("\n📍 Token Accounts:");
  console.log("   Fee Wallet ATA:", feeWalletAta.toBase58());
  console.log("   Destination ATA:", destinationAta.toBase58());
  console.log("   Destination Owner:", destinationPubkey.toBase58());

  // Check fee wallet balance
  let feeBalance;
  try {
    const feeAccountInfo = await connection.getTokenAccountBalance(feeWalletAta);
    feeBalance = feeAccountInfo.value;
    console.log("\n💰 Fee Wallet Balance:", feeBalance.uiAmount, feeBalance.uiAmountString);
  } catch (err) {
    console.error("\n❌ Fee wallet token account not found!");
    console.log("   Create it first with:");
    console.log(`   spl-token create-account ${paymentMint.toBase58()} --owner ${feeWalletKeypair.publicKey.toBase58()}`);
    process.exit(1);
  }

  if (feeBalance.uiAmount === 0) {
    console.log("\n⚠️  No fees to withdraw!");
    process.exit(0);
  }

  // Determine withdrawal amount
  let withdrawAmount: number;
  let withdrawAmountRaw: bigint;

  if (AMOUNT !== null) {
    withdrawAmount = AMOUNT;
    withdrawAmountRaw = BigInt(Math.floor(AMOUNT * Math.pow(10, feeBalance.decimals)));
    
    if (withdrawAmountRaw > BigInt(feeBalance.amount)) {
      console.error(`\n❌ Insufficient balance! Requested: ${AMOUNT}, Available: ${feeBalance.uiAmount}`);
      process.exit(1);
    }
  } else {
    // Withdraw all
    withdrawAmount = feeBalance.uiAmount!;
    withdrawAmountRaw = BigInt(feeBalance.amount);
  }

  console.log("\n💸 Withdrawal Details:");
  console.log("   Amount:", withdrawAmount);
  console.log("   Raw Amount:", withdrawAmountRaw.toString());
  console.log("   Remaining:", feeBalance.uiAmount! - withdrawAmount);

  // Check if destination ATA exists
  try {
    await connection.getTokenAccountBalance(destinationAta);
  } catch (err) {
    console.log("\n⚠️  Destination token account doesn't exist");
    console.log("   Creating it automatically...");
    // The transaction will fail if it doesn't exist, user should create it manually
    console.log(`   Run: spl-token create-account ${paymentMint.toBase58()}`);
    process.exit(1);
  }

  console.log("\n🚀 Withdrawing fees...");

  try {
    const tx = await program.methods
      .withdrawFees(new anchor.BN(withdrawAmountRaw.toString()))
      .accounts({
        config: configPda,
        authority: authorityKeypair.publicKey,
        feeWallet: feeWalletKeypair.publicKey,
        paymentMint: paymentMint,
        feeWalletAta: feeWalletAta,
        destinationAta: destinationAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([feeWalletKeypair]) // Fee wallet must sign
      .rpc();

    console.log("✅ Withdrawal successful!");
    console.log("   Transaction:", tx);

    // Check new balances
    const newFeeBalance = await connection.getTokenAccountBalance(feeWalletAta);
    const newDestBalance = await connection.getTokenAccountBalance(destinationAta);

    console.log("\n💰 Updated Balances:");
    console.log("   Fee Wallet:", newFeeBalance.value.uiAmount);
    console.log("   Destination:", newDestBalance.value.uiAmount);

    // Log withdrawal
    const logPath = path.join(
      __dirname,
      `../../.fee-withdrawals-${NETWORK}.json`
    );
    
    let withdrawals = [];
    if (fs.existsSync(logPath)) {
      withdrawals = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    }
    
    withdrawals.push({
      timestamp: new Date().toISOString(),
      paymentMint: paymentMint.toBase58(),
      amount: withdrawAmount,
      rawAmount: withdrawAmountRaw.toString(),
      destination: destinationPubkey.toBase58(),
      transaction: tx,
    });
    
    fs.writeFileSync(logPath, JSON.stringify(withdrawals, null, 2));
    console.log("\n💾 Withdrawal logged to:", logPath);

    console.log("\n✨ Withdrawal complete!");

  } catch (error: any) {
    console.error("\n❌ Error withdrawing fees:");
    console.error(error);
    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
