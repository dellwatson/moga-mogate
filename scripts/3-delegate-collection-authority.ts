/**
 * Step 3: Delegate Collection Authority to Program
 * 
 * This script delegates collection verification authority to the raffle program's PDA.
 * This allows the program to verify prize NFTs belong to the collection.
 * 
 * Prerequisites:
 *   - Prize collection created (run 2-create-prize-collection.ts first)
 *   - Raffle program deployed
 * 
 * Usage:
 *   bun run scripts/3-delegate-collection-authority.ts
 */

import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
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

// Program IDs (from Anchor.toml)
const PROGRAM_IDS = {
  rwa_raffle: new PublicKey('5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M'),
  direct_sell: new PublicKey('Di1ectSe11111111111111111111111111111111111'),
  // Add more programs as needed
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🚀 Delegating Collection Authority to Programs\n');
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

  // Load collection config
  const configPath = path.join(__dirname, '../.prize-collection.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ Prize collection not found!');
    console.log('Run: bun run scripts/2-create-prize-collection.ts first');
    process.exit(1);
  }

  const collectionConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const collectionMint = new PublicKey(collectionConfig.collectionMint);

  console.log('Collection Mint:', collectionMint.toBase58());
  console.log();

  // Initialize Metaplex
  const metaplex = Metaplex.make(connection).use(keypairIdentity(wallet));

  // Delegate to each program
  const delegations: { program: string; pda: string; bump: number }[] = [];

  for (const [programName, programId] of Object.entries(PROGRAM_IDS)) {
    console.log(`📝 Delegating to ${programName}`);
    console.log('─'.repeat(60));
    console.log('Program ID:', programId.toBase58());

    // Derive collection authority PDA
    const [collectionAuthority, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_authority'), collectionMint.toBuffer()],
      programId
    );

    console.log('Collection Authority PDA:', collectionAuthority.toBase58());
    console.log('Bump:', bump);

    try {
      // Check if already delegated
      const collectionNft = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
      const existingAuthorities = collectionNft.collectionDetails?.approvedCollectionAuthorities || [];
      const alreadyDelegated = existingAuthorities.some(
        auth => auth.address.equals(collectionAuthority)
      );

      if (alreadyDelegated) {
        console.log('⚠️  Already delegated, skipping...');
      } else {
        // Delegate collection authority
        await metaplex.nfts().approveCollectionAuthority({
          mintAddress: collectionMint,
          collectionAuthority: collectionAuthority,
          updateAuthority: wallet,
        });

        console.log('✅ Collection authority delegated!');
      }

      delegations.push({
        program: programName,
        pda: collectionAuthority.toBase58(),
        bump,
      });
    } catch (error: any) {
      console.error('❌ Failed to delegate:', error.message);
    }

    console.log();
  }

  console.log('📝 Verification');
  console.log('─'.repeat(60));

  // Verify all delegations
  const collectionNft = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
  const authorities = collectionNft.collectionDetails?.approvedCollectionAuthorities || [];

  console.log('Approved Collection Authorities:');
  authorities.forEach((auth, i) => {
    const delegation = delegations.find(d => d.pda === auth.address.toBase58());
    if (delegation) {
      console.log(`  ${i + 1}. ${delegation.program}: ${auth.address.toBase58()}`);
    } else {
      console.log(`  ${i + 1}. Unknown: ${auth.address.toBase58()}`);
    }
  });
  console.log();

  console.log('📝 Save Delegation Config');
  console.log('─'.repeat(60));

  const delegationConfig = {
    network: NETWORK,
    collectionMint: collectionMint.toBase58(),
    delegations,
    delegatedAt: new Date().toISOString(),
  };

  const delegationPath = path.join(__dirname, '../.collection-delegations.json');
  fs.writeFileSync(delegationPath, JSON.stringify(delegationConfig, null, 2));
  console.log('✅ Delegation config saved to .collection-delegations.json');
  console.log();

  console.log('📝 Update Program Code');
  console.log('─'.repeat(60));
  console.log('Add this to programs/rwa_raffle/src/lib.rs:');
  console.log();
  console.log(`pub const PRIZE_COLLECTION_MINT: Pubkey = pubkey!("${collectionMint.toBase58()}");`);
  console.log();
  console.log('Add this to programs/direct_sell/src/lib.rs:');
  console.log();
  console.log(`pub const PRIZE_COLLECTION_MINT: Pubkey = pubkey!("${collectionMint.toBase58()}");`);
  console.log();

  console.log('✅ Collection Authority Delegation Complete!');
  console.log();
  console.log('Next steps:');
  console.log('1. Update PRIZE_COLLECTION_MINT in your programs');
  console.log('2. Rebuild programs: cargo build-sbf --features metaplex');
  console.log('3. Deploy programs');
  console.log('4. Test prize minting on devnet');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
