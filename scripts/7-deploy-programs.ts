/**
 * Step 7: Deploy Solana Programs
 * 
 * This script helps you build and deploy all Solana programs.
 * 
 * Prerequisites:
 *   - Anchor CLI installed
 *   - Programs built successfully
 *   - Sufficient SOL for deployment
 * 
 * Usage:
 *   bun run scripts/7-deploy-programs.ts
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { execSync } from 'child_process';
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

const PROGRAMS = [
  {
    name: 'rwa_raffle',
    path: 'programs/rwa_raffle',
    features: 'metaplex,pyth-jupiter,bubblegum',
    description: 'Main raffle program with MOGA payments and prize minting',
  },
  {
    name: 'direct_sell',
    path: 'programs/direct_sell',
    features: 'pyth-jupiter',
    description: 'Direct sell program for instant NFT purchases',
  },
  {
    name: 'rwa_redeem',
    path: 'programs/rwa_redeem',
    features: '',
    description: 'RWA redemption program',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function runCommand(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.stderr || error.message}`);
  }
}

function getProgramSize(programName: string): number {
  const soPath = path.join(process.cwd(), `target/deploy/${programName}.so`);
  if (!fs.existsSync(soPath)) {
    return 0;
  }
  const stats = fs.statSync(soPath);
  return stats.size;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🚀 Deploying Solana Programs\n');
  console.log('Network:', NETWORK);
  console.log('RPC:', RPC_URL);
  console.log();

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log('Deployer:', payer.publicKey.toBase58());

  // Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  console.log();

  if (NETWORK === 'mainnet' && balance < 5 * 1e9) {
    console.error('❌ Insufficient balance for mainnet deployment.');
    console.log('Need at least 5 SOL for deployment.');
    process.exit(1);
  }

  if (NETWORK === 'devnet' && balance < 0.5 * 1e9) {
    console.error('❌ Insufficient balance for devnet deployment.');
    console.log('Get devnet SOL: solana airdrop 2');
    process.exit(1);
  }

  console.log('📝 Step 1: Check Anchor Installation');
  console.log('─'.repeat(60));

  try {
    const anchorVersion = runCommand('anchor --version');
    console.log('✅ Anchor installed:', anchorVersion.trim());
  } catch (error) {
    console.error('❌ Anchor not installed!');
    console.log('Install: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force');
    process.exit(1);
  }

  console.log();

  console.log('📝 Step 2: Build Programs');
  console.log('─'.repeat(60));

  for (const program of PROGRAMS) {
    console.log(`\nBuilding ${program.name}...`);
    console.log(`Features: ${program.features || 'none'}`);

    try {
      const buildCmd = program.features
        ? `cargo build-sbf --manifest-path ${program.path}/Cargo.toml --features ${program.features}`
        : `cargo build-sbf --manifest-path ${program.path}/Cargo.toml`;

      console.log(`Running: ${buildCmd}`);
      const output = runCommand(buildCmd);
      
      const size = getProgramSize(program.name);
      console.log(`✅ ${program.name} built successfully (${(size / 1024).toFixed(2)} KB)`);
    } catch (error: any) {
      console.error(`❌ Failed to build ${program.name}:`, error.message);
      process.exit(1);
    }
  }

  console.log();
  console.log('📝 Step 3: Deploy Programs');
  console.log('─'.repeat(60));

  const deployedPrograms: { name: string; programId: string }[] = [];

  for (const program of PROGRAMS) {
    console.log(`\nDeploying ${program.name}...`);

    try {
      // Check if program keypair exists
      const keypairPath = path.join(process.cwd(), `target/deploy/${program.name}-keypair.json`);
      if (!fs.existsSync(keypairPath)) {
        console.log('⚠️  Program keypair not found, generating new one...');
        runCommand(`solana-keygen new --no-bip39-passphrase --outfile ${keypairPath}`);
      }

      // Load program ID
      const programKeypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
      const programKeypair = Keypair.fromSecretKey(Uint8Array.from(programKeypairData));
      const programId = programKeypair.publicKey.toBase58();

      console.log(`Program ID: ${programId}`);

      // Deploy
      const soPath = path.join(process.cwd(), `target/deploy/${program.name}.so`);
      const deployCmd = `solana program deploy ${soPath} --program-id ${keypairPath} --url ${RPC_URL}`;
      
      console.log('Deploying...');
      const output = runCommand(deployCmd);
      console.log(`✅ ${program.name} deployed successfully`);
      console.log(output.trim());

      deployedPrograms.push({ name: program.name, programId });
    } catch (error: any) {
      console.error(`❌ Failed to deploy ${program.name}:`, error.message);
      process.exit(1);
    }
  }

  console.log();
  console.log('📝 Step 4: Verify Deployments');
  console.log('─'.repeat(60));

  for (const { name, programId } of deployedPrograms) {
    try {
      const pubkey = new PublicKey(programId);
      const accountInfo = await connection.getAccountInfo(pubkey);
      
      if (accountInfo) {
        console.log(`✅ ${name}: ${programId}`);
        console.log(`   Executable: ${accountInfo.executable}`);
        console.log(`   Data size: ${(accountInfo.data.length / 1024).toFixed(2)} KB`);
      } else {
        console.log(`❌ ${name}: Not found on-chain`);
      }
    } catch (error: any) {
      console.log(`❌ ${name}: Verification failed - ${error.message}`);
    }
  }

  console.log();
  console.log('📝 Step 5: Save Deployment Config');
  console.log('─'.repeat(60));

  const config = {
    network: NETWORK,
    programs: deployedPrograms.reduce((acc, { name, programId }) => {
      acc[name] = programId;
      return acc;
    }, {} as Record<string, string>),
    deployedAt: new Date().toISOString(),
    deployer: payer.publicKey.toBase58(),
  };

  const configPath = path.join(process.cwd(), `.programs-${NETWORK}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Deployment config saved to .programs-${NETWORK}.json`);

  console.log();
  console.log('📝 Step 6: Update Anchor.toml');
  console.log('─'.repeat(60));
  console.log('Update Anchor.toml with these program IDs:');
  console.log();
  console.log(`[programs.${NETWORK}]`);
  for (const { name, programId } of deployedPrograms) {
    console.log(`${name} = "${programId}"`);
  }

  console.log();
  console.log('📝 Step 7: Update Environment Variables');
  console.log('─'.repeat(60));
  console.log('Add these to your .env file:');
  console.log();
  for (const { name, programId } of deployedPrograms) {
    const envVar = `${name.toUpperCase()}_PROGRAM_ID_${NETWORK.toUpperCase()}`;
    console.log(`${envVar}=${programId}`);
  }

  console.log();
  console.log('✅ Program Deployment Complete!');
  console.log();
  console.log('Next steps:');
  console.log('1. Update Anchor.toml with program IDs');
  console.log('2. Update .env with program IDs');
  console.log('3. Run: bun run scripts/8-test-programs.ts');
  console.log('4. Verify programs on Solana Explorer');
  console.log();
  console.log('🔗 Solana Explorer:');
  const explorerBase = NETWORK === 'mainnet' 
    ? 'https://explorer.solana.com'
    : 'https://explorer.solana.com?cluster=devnet';
  for (const { name, programId } of deployedPrograms) {
    console.log(`${name}: ${explorerBase}/address/${programId}`);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
