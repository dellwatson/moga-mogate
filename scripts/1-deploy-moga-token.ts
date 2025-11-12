/**
 * Step 1: Deploy MOGA Token (SPL Token)
 *
 * This script creates the MOGA token mint with proper configuration.
 * Run this ONCE on each network (devnet/mainnet).
 *
 * Usage:
 *   bun run scripts/1-deploy-moga-token.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";

// ============================================================================
// Configuration
// ============================================================================

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL =
  process.env.SOLANA_RPC_URL || NETWORK === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

const WALLET_PATH =
  process.env.WALLET_PATH ||
  path.join(process.env.HOME!, ".config/solana/id.json");

// MOGA Token Configuration
const MOGA_CONFIG = {
  name: "Mogate Token",
  symbol: "MOGA",
  decimals: 9,
  initialSupply: 8_000_000_000, // 8 billion MOGA
  description: "Mogate platform utility token",
  image:
    "https://pbs.twimg.com/profile_images/1981074902288351233/_cmsEwgO_400x400.jpg", // TODO: Upload to Arweave
  // image: "https://arweave.net/moga-token-logo.png", // TODO: Upload to Arweave
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("🚀 Deploying MOGA Token\n");
  console.log("Network:", NETWORK);
  console.log("RPC:", RPC_URL);
  console.log();

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log("Payer:", payer.publicKey.toBase58());

  // Connect to Solana
  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");
  console.log();

  if (balance < 0.1 * 1e9) {
    console.error(
      "❌ Insufficient balance. Need at least 0.1 SOL for deployment."
    );
    if (NETWORK === "devnet") {
      console.log("Get devnet SOL: solana airdrop 2");
    }
    process.exit(1);
  }

  // Check if MOGA token already exists
  const configPath = path.join(__dirname, "../.moga-token.json");
  if (fs.existsSync(configPath)) {
    const existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log("⚠️  MOGA token already deployed!");
    console.log("Mint:", existingConfig.mint);
    console.log("Network:", existingConfig.network);
    console.log();
    console.log("To redeploy, delete .moga-token.json and run again.");
    process.exit(0);
  }

  console.log("📝 Step 1: Create MOGA Token Mint");
  console.log("─".repeat(60));

  // Create mint
  const mintKeypair = Keypair.generate();
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority
    MOGA_CONFIG.decimals,
    mintKeypair,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );

  console.log("✅ MOGA Token Mint created:", mint.toBase58());
  console.log();

  console.log("📝 Step 2: Create Associated Token Account");
  console.log("─".repeat(60));

  // Create ATA for payer
  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("✅ ATA created:", payerAta.address.toBase58());
  console.log();

  console.log("📝 Step 3: Mint Initial Supply");
  console.log("─".repeat(60));

  // Mint initial supply
  const initialSupplyLamports =
    BigInt(MOGA_CONFIG.initialSupply) * BigInt(10 ** MOGA_CONFIG.decimals);
  const mintTx = await mintTo(
    connection,
    payer,
    mint,
    payerAta.address,
    payer,
    initialSupplyLamports,
    [],
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );

  console.log("✅ Minted", MOGA_CONFIG.initialSupply.toLocaleString(), "MOGA");
  console.log("Transaction:", mintTx);
  console.log();

  console.log("📝 Step 4: Verify Token");
  console.log("─".repeat(60));

  const mintInfo = await getMint(
    connection,
    mint,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  console.log("Mint Authority:", mintInfo.mintAuthority?.toBase58());
  console.log("Freeze Authority:", mintInfo.freezeAuthority?.toBase58());
  console.log("Decimals:", mintInfo.decimals);
  console.log(
    "Supply:",
    (Number(mintInfo.supply) / 10 ** mintInfo.decimals).toLocaleString(),
    "MOGA"
  );
  console.log();

  console.log("📝 Step 5: Save Configuration");
  console.log("─".repeat(60));

  const config = {
    network: NETWORK,
    mint: mint.toBase58(),
    mintAuthority: payer.publicKey.toBase58(),
    freezeAuthority: payer.publicKey.toBase58(),
    decimals: MOGA_CONFIG.decimals,
    initialSupply: MOGA_CONFIG.initialSupply,
    deployedAt: new Date().toISOString(),
    ...MOGA_CONFIG,
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✅ Configuration saved to .moga-token.json");
  console.log();

  console.log("📝 Step 6: Update Environment Variables");
  console.log("─".repeat(60));
  console.log("Add this to your .env file:");
  console.log();
  console.log(`MOGA_MINT_${NETWORK.toUpperCase()}=${mint.toBase58()}`);
  console.log();

  console.log("✅ MOGA Token Deployment Complete!");
  console.log();
  console.log("Next steps:");
  console.log("1. Update .env with MOGA_MINT address");
  console.log("2. Run: bun run scripts/2-create-prize-collection.ts");
  console.log("3. (Optional) Create token metadata with Metaplex");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
