/**
 * Step 6: Setup Stablecoins for Raffles
 * 
 * This script helps you set up stablecoins for your platform.
 * 
 * Options:
 * 1. Use existing stablecoins (USDC, USDT, etc.) - RECOMMENDED
 * 2. Create a new test stablecoin (devnet only)
 * 
 * Usage:
 *   bun run scripts/6-setup-stablecoins.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';
import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const RPC_URL = process.env.SOLANA_RPC_URL || 
  NETWORK === 'mainnet' 
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com';

const WALLET_PATH = process.env.WALLET_PATH || 
  path.join(process.env.HOME!, '.config/solana/id.json');

// Known Stablecoin Addresses
const KNOWN_STABLECOINS = {
  mainnet: {
    USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
    DAI: new PublicKey('EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o'),
    PYUSD: new PublicKey('2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo'),
  },
  devnet: {
    USDC: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), // Devnet USDC
    // Note: Other stablecoins may not exist on devnet
  },
};

// Test Stablecoin Configuration (for devnet)
const TEST_STABLECOIN_CONFIG = {
  name: 'Test USDC',
  symbol: 'tUSDC',
  decimals: 6, // Same as real USDC
  initialSupply: 1_000_000, // 1 million test USDC
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('💵 Stablecoin Setup for Mogate Platform\n');
  console.log('Network:', NETWORK);
  console.log('RPC:', RPC_URL);
  console.log();

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log('Payer:', payer.publicKey.toBase58());

  // Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  console.log();

  console.log('📝 Stablecoin Options');
  console.log('─'.repeat(60));
  console.log();

  if (NETWORK === 'mainnet') {
    console.log('🌐 MAINNET - Use Existing Stablecoins (RECOMMENDED)');
    console.log();
    console.log('Available stablecoins:');
    console.log('1. USDC:', KNOWN_STABLECOINS.mainnet.USDC.toBase58());
    console.log('2. USDT:', KNOWN_STABLECOINS.mainnet.USDT.toBase58());
    console.log('3. DAI:', KNOWN_STABLECOINS.mainnet.DAI.toBase58());
    console.log('4. PYUSD:', KNOWN_STABLECOINS.mainnet.PYUSD.toBase58());
    console.log();
    console.log('💡 Organizers can choose any of these when creating raffles.');
    console.log('💡 No setup needed - these tokens already exist!');
    console.log();

    // Save config
    const config = {
      network: NETWORK,
      stablecoins: {
        USDC: KNOWN_STABLECOINS.mainnet.USDC.toBase58(),
        USDT: KNOWN_STABLECOINS.mainnet.USDT.toBase58(),
        DAI: KNOWN_STABLECOINS.mainnet.DAI.toBase58(),
        PYUSD: KNOWN_STABLECOINS.mainnet.PYUSD.toBase58(),
      },
      default: 'USDC',
      updatedAt: new Date().toISOString(),
    };

    const configPath = path.join(__dirname, '../.stablecoins.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Stablecoin config saved to .stablecoins.json');
    console.log();

    console.log('📝 Update Environment Variables');
    console.log('─'.repeat(60));
    console.log('Add this to your .env file:');
    console.log();
    console.log(`USDC_MINT_MAINNET=${KNOWN_STABLECOINS.mainnet.USDC.toBase58()}`);
    console.log(`USDT_MINT_MAINNET=${KNOWN_STABLECOINS.mainnet.USDT.toBase58()}`);
    console.log(`DAI_MINT_MAINNET=${KNOWN_STABLECOINS.mainnet.DAI.toBase58()}`);
    console.log();

  } else {
    // Devnet
    console.log('🧪 DEVNET - Choose an option:');
    console.log();
    console.log('Option 1: Use Devnet USDC (RECOMMENDED for testing)');
    console.log('  Mint:', KNOWN_STABLECOINS.devnet.USDC.toBase58());
    console.log('  Get tokens: https://spl-token-faucet.com/');
    console.log();
    console.log('Option 2: Create Test Stablecoin (for isolated testing)');
    console.log('  Creates a new token you fully control');
    console.log();

    const configPath = path.join(__dirname, '../.stablecoins.json');
    
    // Check if test stablecoin already exists
    if (fs.existsSync(configPath)) {
      const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (existingConfig.testStablecoin) {
        console.log('⚠️  Test stablecoin already created!');
        console.log('Mint:', existingConfig.testStablecoin.mint);
        console.log();
        console.log('To recreate, delete .stablecoins.json and run again.');
        process.exit(0);
      }
    }

    // Ask user which option (for now, default to Option 1)
    console.log('📝 Using Option 1: Devnet USDC');
    console.log('─'.repeat(60));
    console.log();

    const config = {
      network: NETWORK,
      stablecoins: {
        USDC: KNOWN_STABLECOINS.devnet.USDC.toBase58(),
      },
      default: 'USDC',
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Stablecoin config saved to .stablecoins.json');
    console.log();

    console.log('📝 Get Devnet USDC');
    console.log('─'.repeat(60));
    console.log('Visit: https://spl-token-faucet.com/');
    console.log('Or use: https://everlastingsong.github.io/nebula/');
    console.log();
    console.log('Your wallet:', payer.publicKey.toBase58());
    console.log('USDC Mint:', KNOWN_STABLECOINS.devnet.USDC.toBase58());
    console.log();

    console.log('📝 Update Environment Variables');
    console.log('─'.repeat(60));
    console.log('Add this to your .env file:');
    console.log();
    console.log(`USDC_MINT_DEVNET=${KNOWN_STABLECOINS.devnet.USDC.toBase58()}`);
    console.log();

    console.log('💡 Optional: Create Test Stablecoin');
    console.log('─'.repeat(60));
    console.log('If you want to create your own test stablecoin for isolated testing,');
    console.log('uncomment the code below and run again.');
    console.log();
  }

  console.log('✅ Stablecoin Setup Complete!');
  console.log();
  console.log('Next steps:');
  console.log('1. Update .env with stablecoin addresses');
  console.log('2. Organizers can choose which stablecoin to use when creating raffles');
  console.log('3. Platform supports multiple stablecoins dynamically');
  console.log();
  console.log('💡 How it works:');
  console.log('When creating a raffle, organizer passes the stablecoin mint:');
  console.log('  await sdk.createRaffle({');
  console.log('    mint: usdcMint, // ← Organizer chooses USDC, USDT, DAI, etc.');
  console.log('    // ...');
  console.log('  });');
}

// ============================================================================
// Optional: Create Test Stablecoin (Devnet Only)
// ============================================================================

async function createTestStablecoin() {
  console.log('📝 Creating Test Stablecoin');
  console.log('─'.repeat(60));

  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));
  const connection = new Connection(RPC_URL, 'confirmed');

  // Create mint
  const mintKeypair = Keypair.generate();
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    TEST_STABLECOIN_CONFIG.decimals,
    mintKeypair,
    { commitment: 'confirmed' },
    TOKEN_PROGRAM_ID
  );

  console.log('✅ Test stablecoin created:', mint.toBase58());

  // Create ATA and mint initial supply
  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );

  const initialSupplyLamports = BigInt(TEST_STABLECOIN_CONFIG.initialSupply) * 
    BigInt(10 ** TEST_STABLECOIN_CONFIG.decimals);
  
  await mintTo(
    connection,
    payer,
    mint,
    payerAta.address,
    payer,
    initialSupplyLamports
  );

  console.log('✅ Minted', TEST_STABLECOIN_CONFIG.initialSupply.toLocaleString(), 'test USDC');

  // Save config
  const config = {
    network: NETWORK,
    testStablecoin: {
      mint: mint.toBase58(),
      symbol: TEST_STABLECOIN_CONFIG.symbol,
      decimals: TEST_STABLECOIN_CONFIG.decimals,
      mintAuthority: payer.publicKey.toBase58(),
    },
    stablecoins: {
      tUSDC: mint.toBase58(),
    },
    default: 'tUSDC',
    createdAt: new Date().toISOString(),
  };

  const configPath = path.join(__dirname, '../.stablecoins.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log('✅ Test stablecoin config saved');
  console.log();
  console.log('Add to .env:');
  console.log(`TEST_USDC_MINT_DEVNET=${mint.toBase58()}`);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
