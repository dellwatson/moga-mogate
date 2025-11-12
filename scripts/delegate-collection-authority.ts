/**
 * Delegate Collection Authority to RWA Raffle Program
 * 
 * This script:
 * 1. Creates a collection NFT for prize NFTs
 * 2. Derives the collection authority PDA
 * 3. Delegates collection verification authority to the program
 * 
 * Run once during initial setup.
 */

import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const WALLET_PATH = process.env.WALLET_PATH || path.join(process.env.HOME!, '.config/solana/id.json');
const PROGRAM_ID = new PublicKey('5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M');

// Collection metadata
const COLLECTION_NAME = 'Mogate RWA Prizes';
const COLLECTION_SYMBOL = 'MOGA-PRIZE';
const COLLECTION_URI = 'https://arweave.net/mogate-rwa-collection.json'; // TODO: Upload to Arweave

async function main() {
  console.log('🚀 Delegating Collection Authority to RWA Raffle Program\n');

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log('Wallet:', wallet.publicKey.toBase58());

  // Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');
  const metaplex = Metaplex.make(connection).use(keypairIdentity(wallet));

  console.log('Network:', RPC_URL);
  console.log('Program ID:', PROGRAM_ID.toBase58());
  console.log();

  // Step 1: Create collection NFT (skip if already exists)
  console.log('📦 Step 1: Create Collection NFT');
  console.log('Name:', COLLECTION_NAME);
  console.log('Symbol:', COLLECTION_SYMBOL);
  console.log('URI:', COLLECTION_URI);
  
  let collectionMint: PublicKey;
  
  try {
    const { nft } = await metaplex.nfts().create({
      name: COLLECTION_NAME,
      symbol: COLLECTION_SYMBOL,
      uri: COLLECTION_URI,
      sellerFeeBasisPoints: 0,
      isCollection: true,
      updateAuthority: wallet,
    });
    
    collectionMint = nft.address;
    console.log('✅ Collection created:', collectionMint.toBase58());
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      // Collection already exists, get address from error or prompt user
      console.log('⚠️  Collection already exists. Please provide the mint address:');
      // In production, store this in a config file
      throw new Error('Please set COLLECTION_MINT in environment or config');
    }
    throw error;
  }
  
  console.log();

  // Step 2: Derive collection authority PDA
  console.log('🔑 Step 2: Derive Collection Authority PDA');
  
  const [collectionAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection_authority'), collectionMint.toBuffer()],
    PROGRAM_ID
  );
  
  console.log('Collection Authority PDA:', collectionAuthority.toBase58());
  console.log('Bump:', bump);
  console.log();

  // Step 3: Delegate collection authority to PDA
  console.log('✍️  Step 3: Delegate Collection Authority');
  
  try {
    await metaplex.nfts().approveCollectionAuthority({
      mintAddress: collectionMint,
      collectionAuthority: collectionAuthority,
      updateAuthority: wallet,
    });
    
    console.log('✅ Collection authority delegated to program PDA!');
  } catch (error: any) {
    console.error('❌ Failed to delegate authority:', error.message);
    throw error;
  }
  
  console.log();

  // Step 4: Verify delegation
  console.log('🔍 Step 4: Verify Delegation');
  
  const collectionNft = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
  const delegatedAuthorities = collectionNft.collectionDetails?.approvedCollectionAuthorities || [];
  
  const isDelegated = delegatedAuthorities.some(
    auth => auth.address.equals(collectionAuthority)
  );
  
  if (isDelegated) {
    console.log('✅ Delegation verified!');
  } else {
    console.log('⚠️  Delegation not found. Please check manually.');
  }
  
  console.log();

  // Step 5: Output configuration
  console.log('📝 Step 5: Update Program Configuration');
  console.log();
  console.log('Add this to programs/rwa_raffle/src/lib.rs:');
  console.log('─'.repeat(60));
  console.log(`pub const PRIZE_COLLECTION_MINT: Pubkey = pubkey!("${collectionMint.toBase58()}");`);
  console.log('─'.repeat(60));
  console.log();
  console.log('Add this to programs/direct_sell/src/lib.rs (if using post-mint prizes):');
  console.log('─'.repeat(60));
  console.log(`pub const PRIZE_COLLECTION_MINT: Pubkey = pubkey!("${collectionMint.toBase58()}");`);
  console.log('─'.repeat(60));
  console.log();
  
  console.log('✅ Setup complete! You can now mint prize NFTs on-chain.');
  console.log();
  console.log('Next steps:');
  console.log('1. Update PRIZE_COLLECTION_MINT in your programs');
  console.log('2. Rebuild programs: cargo build-sbf --features metaplex');
  console.log('3. Deploy programs');
  console.log('4. Test claim_prize_mint() instruction');
}

main().catch(console.error);
