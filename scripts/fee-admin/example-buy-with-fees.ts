/**
 * Example: Buy NFT Listing with Platform Fees
 * 
 * This example shows how to integrate the platform fee system
 * into your buy transaction.
 * 
 * Usage:
 *   LISTING=<listing_address> bun run scripts/fee-admin/example-buy-with-fees.ts
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

const LISTING_ADDRESS = process.env.LISTING;

const PROGRAM_ID = new PublicKey(
  "DE9rqqvye7rExak5cjYdkBup5wR9PRYMrbZw17xPooCt"
);

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log("🛒 Buy NFT Listing (with Platform Fees)");
  console.log("========================================\n");

  if (!LISTING_ADDRESS) {
    console.log("❌ LISTING address required!");
    console.log("\nUsage:");
    console.log("  LISTING=<listing_address> bun run scripts/fee-admin/example-buy-with-fees.ts");
    process.exit(1);
  }

  const listingPda = new PublicKey(LISTING_ADDRESS);

  // Load buyer wallet
  const buyerKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
  );

  console.log("Network:", NETWORK);
  console.log("Buyer:", buyerKeypair.publicKey.toBase58());
  console.log("Listing:", listingPda.toBase58());

  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(buyerKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program
  const idlPath = path.join(
    __dirname,
    "../../target/idl/direct_sell_anchor.json"
  );
  
  let idl;
  if (fs.existsSync(idlPath)) {
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  } else {
    idl = await Program.fetchIdl(PROGRAM_ID, provider);
    if (!idl) {
      throw new Error("Could not fetch IDL");
    }
  }

  const program = new Program(idl, PROGRAM_ID, provider);

  // Fetch listing
  console.log("\n📋 Fetching listing...");
  const listing = await program.account.listing.fetch(listingPda);
  
  console.log("   Seller:", listing.seller.toBase58());
  console.log("   NFT Mint:", listing.nftMint.toBase58());
  console.log("   Payment Mint:", listing.paymentMint.toBase58());
  console.log("   Price:", listing.price.toString());
  console.log("   Sold:", listing.sold);

  if (listing.sold) {
    console.log("\n❌ Listing already sold!");
    process.exit(1);
  }

  // Load platform config
  console.log("\n⚙️  Loading platform config...");
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const config = await program.account.platformConfig.fetch(configPda);
  console.log("   Config PDA:", configPda.toBase58());
  console.log("   Fee Wallet:", config.feeWallet.toBase58());
  console.log("   Fee BPS:", config.feeBps, `(${config.feeBps / 100}%)`);

  // Calculate fees
  const totalPrice = listing.price.toNumber();
  const platformFee = Math.floor((totalPrice * config.feeBps) / 10000);
  const sellerAmount = totalPrice - platformFee;

  console.log("\n💰 Payment Breakdown:");
  console.log("   Total Price:", totalPrice);
  console.log("   Platform Fee:", platformFee, `(${config.feeBps / 100}%)`);
  console.log("   Seller Gets:", sellerAmount);

  // Get all token accounts
  const nftMint = listing.nftMint;
  const paymentMint = listing.paymentMint;
  const seller = listing.seller;

  // Buyer's payment ATA
  const buyerPaymentAta = await getAssociatedTokenAddress(
    paymentMint,
    buyerKeypair.publicKey
  );

  // Seller's payment ATA
  const sellerPaymentAta = await getAssociatedTokenAddress(
    paymentMint,
    seller
  );

  // Fee wallet's payment ATA
  const feeWalletAta = await getAssociatedTokenAddress(
    paymentMint,
    config.feeWallet
  );

  // Listing NFT escrow (derive from listing PDA)
  const listingNftEscrow = await getAssociatedTokenAddress(
    nftMint,
    listingPda,
    true // allowOwnerOffCurve
  );

  // Buyer's NFT ATA
  const buyerNftAta = await getAssociatedTokenAddress(
    nftMint,
    buyerKeypair.publicKey
  );

  console.log("\n📍 Token Accounts:");
  console.log("   Buyer Payment ATA:", buyerPaymentAta.toBase58());
  console.log("   Seller Payment ATA:", sellerPaymentAta.toBase58());
  console.log("   Fee Wallet ATA:", feeWalletAta.toBase58());
  console.log("   Listing NFT Escrow:", listingNftEscrow.toBase58());
  console.log("   Buyer NFT ATA:", buyerNftAta.toBase58());

  // Check buyer balance
  console.log("\n💵 Checking buyer balance...");
  const buyerBalance = await connection.getTokenAccountBalance(buyerPaymentAta);
  console.log("   Balance:", buyerBalance.value.uiAmount);

  if (buyerBalance.value.uiAmount! < totalPrice / Math.pow(10, buyerBalance.value.decimals)) {
    console.log("\n❌ Insufficient balance!");
    process.exit(1);
  }

  // Execute buy transaction
  console.log("\n🚀 Executing buy transaction...");

  try {
    const tx = await program.methods
      .buyListing()
      .accounts({
        buyer: buyerKeypair.publicKey,
        seller: seller,
        listing: listingPda,
        config: configPda,  // ← Platform config
        nftMint: nftMint,
        paymentMint: paymentMint,
        buyerPaymentAta: buyerPaymentAta,
        sellerPaymentAta: sellerPaymentAta,
        feeWalletAta: feeWalletAta,  // ← Fee wallet ATA
        listingNftEscrow: listingNftEscrow,
        buyerNftAta: buyerNftAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Purchase successful!");
    console.log("   Transaction:", tx);

    // Verify balances
    console.log("\n💰 Verifying balances...");
    
    const newBuyerBalance = await connection.getTokenAccountBalance(buyerPaymentAta);
    const newSellerBalance = await connection.getTokenAccountBalance(sellerPaymentAta);
    const newFeeBalance = await connection.getTokenAccountBalance(feeWalletAta);
    const newBuyerNftBalance = await connection.getTokenAccountBalance(buyerNftAta);

    console.log("   Buyer Payment:", newBuyerBalance.value.uiAmount);
    console.log("   Seller Payment:", newSellerBalance.value.uiAmount);
    console.log("   Fee Wallet:", newFeeBalance.value.uiAmount);
    console.log("   Buyer NFT:", newBuyerNftBalance.value.uiAmount);

    console.log("\n✨ Purchase complete!");
    console.log("\n📊 Summary:");
    console.log(`   - You paid: ${totalPrice / Math.pow(10, buyerBalance.value.decimals)} tokens`);
    console.log(`   - Platform fee: ${platformFee / Math.pow(10, buyerBalance.value.decimals)} tokens`);
    console.log(`   - Seller received: ${sellerAmount / Math.pow(10, buyerBalance.value.decimals)} tokens`);
    console.log(`   - You received: 1 NFT`);

  } catch (error: any) {
    console.error("\n❌ Error executing purchase:");
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
