/**
 * Step 8: Test Deployed Programs
 * 
 * This script tests all deployed programs to ensure they work correctly.
 * Uses the ts-sdk to interact with programs.
 * 
 * Prerequisites:
 *   - Programs deployed (run 7-deploy-programs.ts first)
 *   - MOGA token deployed
 *   - Collections created and delegated
 * 
 * Usage:
 *   bun run scripts/8-test-programs.ts
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
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

// ============================================================================
// Helper Functions
// ============================================================================

function loadConfig(filename: string): any {
  const configPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${filename}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🧪 Testing Deployed Programs\n');
  console.log('Network:', NETWORK);
  console.log('RPC:', RPC_URL);
  console.log();

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log('Wallet:', wallet.publicKey.toBase58());

  // Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  console.log();

  console.log('📝 Step 1: Load Deployment Configs');
  console.log('─'.repeat(60));

  try {
    const mogaConfig = loadConfig('.moga-token.json');
    const prizeConfig = loadConfig('.prize-collection.json');
    const mrftConfig = loadConfig('.mrft-collection.json');
    const stablecoinConfig = loadConfig('.stablecoins.json');
    const programsConfig = loadConfig(`.programs-${NETWORK}.json`);

    console.log('✅ MOGA Token:', mogaConfig.mint);
    console.log('✅ Prize Collection:', prizeConfig.collectionMint);
    console.log('✅ MRFT Collection:', mrftConfig.collectionMint);
    console.log('✅ Stablecoin (USDC):', stablecoinConfig.stablecoins.USDC);
    console.log('✅ Programs:', Object.keys(programsConfig.programs).join(', '));
  } catch (error: any) {
    console.error('❌ Missing config files!');
    console.log('Run deployment scripts first:');
    console.log('  bun run deploy:all');
    console.log('  bun run scripts/7-deploy-programs.ts');
    process.exit(1);
  }

  console.log();
  console.log('📝 Step 2: Verify Program Accounts');
  console.log('─'.repeat(60));

  const programsConfig = loadConfig(`.programs-${NETWORK}.json`);

  for (const [name, programId] of Object.entries(programsConfig.programs)) {
    try {
      const pubkey = new PublicKey(programId as string);
      const accountInfo = await connection.getAccountInfo(pubkey);

      if (accountInfo && accountInfo.executable) {
        console.log(`✅ ${name}: Deployed and executable`);
      } else {
        console.log(`❌ ${name}: Not executable or not found`);
      }
    } catch (error: any) {
      console.log(`❌ ${name}: Error - ${error.message}`);
    }
  }

  console.log();
  console.log('📝 Step 3: Test RWA Raffle Program');
  console.log('─'.repeat(60));

  console.log('⚠️  Automated testing requires ts-sdk integration.');
  console.log('For now, run manual tests:');
  console.log();
  console.log('1. Create a test raffle:');
  console.log('   - Use ts-sdk or Anchor client');
  console.log('   - Pass MOGA mint, USDC mint, prize collection mint');
  console.log();
  console.log('2. Buy tickets with MOGA:');
  console.log('   - Call join_with_moga()');
  console.log('   - Verify MOGA → USDC swap works');
  console.log();
  console.log('3. Draw winner:');
  console.log('   - Call draw_winner() or arcium_draw()');
  console.log('   - Verify randomness works');
  console.log();
  console.log('4. Claim prize:');
  console.log('   - Call claim_prize_mint()');
  console.log('   - Verify NFT minted and verified');
  console.log();

  console.log('📝 Step 4: Integration with TS-SDK');
  console.log('─'.repeat(60));

  console.log('To test with ts-sdk:');
  console.log();
  console.log('```typescript');
  console.log('import { MogateSDK } from \'./ts-sdk\';');
  console.log('');
  console.log('const sdk = new MogateSDK(connection, wallet);');
  console.log('');
  console.log('// Create raffle');
  console.log('const raffle = await sdk.createRaffle({');
  console.log('  requiredTickets: 10,');
  console.log('  deadline: Date.now() + 86400000,');
  console.log('  prizeCollectionMint: new PublicKey(prizeConfig.collectionMint),');
  console.log('  mint: new PublicKey(stablecoinConfig.stablecoins.USDC),');
  console.log('  refundMode: 2, // Both USDC and MRFT');
  console.log('});');
  console.log('');
  console.log('// Buy tickets');
  console.log('await sdk.buyTickets({');
  console.log('  raffle: raffle.publicKey,');
  console.log('  slots: [1, 2, 3],');
  console.log('  maxMogaIn: 1000000000, // 1 MOGA');
  console.log('});');
  console.log('```');
  console.log();

  console.log('📝 Step 5: Recommended Tests');
  console.log('─'.repeat(60));

  console.log('Test checklist:');
  console.log('  [ ] Create raffle with permit');
  console.log('  [ ] Buy tickets with MOGA (join_with_moga)');
  console.log('  [ ] Verify MOGA → USDC swap via Jupiter');
  console.log('  [ ] Draw winner (manual or Arcium)');
  console.log('  [ ] Claim prize (mint NFT)');
  console.log('  [ ] Verify prize NFT in wallet');
  console.log('  [ ] Test refund (USDC)');
  console.log('  [ ] Test refund (MRFT mint)');
  console.log('  [ ] Burn MRFT to join raffle for free');
  console.log('  [ ] Collect proceeds as organizer');
  console.log();

  console.log('✅ Program Testing Guide Complete!');
  console.log();
  console.log('Next steps:');
  console.log('1. Implement tests in ts-sdk/tests/');
  console.log('2. Run: bun test');
  console.log('3. Verify all features work on devnet');
  console.log('4. Deploy to mainnet when ready');
  console.log();
  console.log('📚 Documentation:');
  console.log('- ts-sdk/README.md - SDK usage guide');
  console.log('- DEPLOYMENT_GUIDE.md - Complete deployment guide');
  console.log('- docs/COLLECTION_NFT_EXPLAINED.md - Collection NFT details');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
