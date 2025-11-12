/**
 * Step 5: Delegate MRFT Collection Authority to Program
 * 
 * This script delegates MRFT collection authority to the raffle program's PDA.
 * This allows the program to mint MRFT NFTs when raffles fail.
 * 
 * Prerequisites:
 *   - MRFT collection created (run 4-create-mrft-collection.ts first)
 *   - Raffle program deployed
 * 
 * Usage:
 *   bun run scripts/5-delegate-mrft-authority.ts
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

// Program ID (from Anchor.toml)
const RAFFLE_PROGRAM_ID = new PublicKey('5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M');

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🎫 Delegating MRFT Collection Authority to Raffle Program\n');
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

  // Load MRFT collection config
  const configPath = path.join(__dirname, '../.mrft-collection.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ MRFT collection not found!');
    console.log('Run: bun run scripts/4-create-mrft-collection.ts first');
    process.exit(1);
  }

  const mrftConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const collectionMint = new PublicKey(mrftConfig.collectionMint);

  console.log('MRFT Collection Mint:', collectionMint.toBase58());
  console.log('Raffle Program ID:', RAFFLE_PROGRAM_ID.toBase58());
  console.log();

  // Initialize Metaplex
  const metaplex = Metaplex.make(connection).use(keypairIdentity(wallet));

  console.log('📝 Deriving MRFT Authority PDA');
  console.log('─'.repeat(60));

  // Derive MRFT authority PDA
  const [mrftAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('mrft_authority'), collectionMint.toBuffer()],
    RAFFLE_PROGRAM_ID
  );

  console.log('MRFT Authority PDA:', mrftAuthority.toBase58());
  console.log('Bump:', bump);
  console.log();

  console.log('📝 Delegating Collection Authority');
  console.log('─'.repeat(60));

  try {
    // Check if already delegated
    const collectionNft = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
    const existingAuthorities = collectionNft.collectionDetails?.approvedCollectionAuthorities || [];
    const alreadyDelegated = existingAuthorities.some(
      auth => auth.address.equals(mrftAuthority)
    );

    if (alreadyDelegated) {
      console.log('⚠️  Already delegated!');
    } else {
      // Delegate collection authority
      await metaplex.nfts().approveCollectionAuthority({
        mintAddress: collectionMint,
        collectionAuthority: mrftAuthority,
        updateAuthority: wallet,
      });

      console.log('✅ MRFT collection authority delegated!');
    }
  } catch (error: any) {
    console.error('❌ Failed to delegate:', error.message);
    process.exit(1);
  }

  console.log();

  console.log('📝 Verification');
  console.log('─'.repeat(60));

  // Verify delegation
  const collectionNft = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
  const authorities = collectionNft.collectionDetails?.approvedCollectionAuthorities || [];

  console.log('Approved MRFT Authorities:');
  authorities.forEach((auth, i) => {
    const isOurs = auth.address.equals(mrftAuthority);
    console.log(`  ${i + 1}. ${auth.address.toBase58()} ${isOurs ? '✅' : ''}`);
  });
  console.log();

  console.log('📝 Save Delegation Config');
  console.log('─'.repeat(60));

  const delegationConfig = {
    network: NETWORK,
    mrftCollectionMint: collectionMint.toBase58(),
    mrftAuthority: mrftAuthority.toBase58(),
    mrftAuthorityBump: bump,
    raffleProgramId: RAFFLE_PROGRAM_ID.toBase58(),
    delegatedAt: new Date().toISOString(),
  };

  const delegationPath = path.join(__dirname, '../.mrft-delegation.json');
  fs.writeFileSync(delegationPath, JSON.stringify(delegationConfig, null, 2));
  console.log('✅ Delegation config saved to .mrft-delegation.json');
  console.log();

  console.log('📝 Update Program Code');
  console.log('─'.repeat(60));
  console.log('Add this to programs/rwa_raffle/src/lib.rs:');
  console.log();
  console.log(`pub const MRFT_COLLECTION_MINT: Pubkey = pubkey!("${collectionMint.toBase58()}");`);
  console.log();

  console.log('✅ MRFT Collection Authority Delegation Complete!');
  console.log();
  console.log('Next steps:');
  console.log('1. Update MRFT_COLLECTION_MINT in programs/rwa_raffle/src/lib.rs');
  console.log('2. Rebuild programs: cargo build-sbf --features metaplex,bubblegum');
  console.log('3. Deploy programs');
  console.log('4. Test MRFT minting on devnet');
  console.log();
  console.log('💡 How MRFT works:');
  console.log('When a raffle fails and refund_mode allows MRFT:');
  console.log('1. User calls mint_mrft_refund()');
  console.log('2. Program mints MRFT NFT to user');
  console.log('3. User can burn MRFT to join future raffles for free');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
