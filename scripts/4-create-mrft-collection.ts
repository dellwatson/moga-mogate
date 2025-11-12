/**
 * Step 4: Create MRFT Collection (Mogate Raffle Free Ticket)
 * 
 * This script creates the MRFT collection for refund tickets.
 * When raffles fail, users can receive MRFT NFTs instead of USDC refunds.
 * MRFT can be burned to join future raffles for free.
 * 
 * Prerequisites:
 *   - Prize collection created (run 2-create-prize-collection.ts first)
 *   - Metaplex SDK installed
 * 
 * Usage:
 *   bun run scripts/4-create-mrft-collection.ts
 */

import { Metaplex, keypairIdentity, bundlrStorage } from '@metaplex-foundation/js';
import { Connection, Keypair } from '@solana/web3.js';
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

// MRFT Collection Configuration
const MRFT_CONFIG = {
  name: 'Mogate Raffle Free Ticket',
  symbol: 'MRFT',
  description: 'Free ticket NFTs for failed raffles. Burn to join future raffles for free.',
  image: 'https://arweave.net/mogate-mrft-collection.png', // TODO: Upload to Arweave
  externalUrl: 'https://mogate.io/mrft',
  sellerFeeBasisPoints: 0, // 0% royalty
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🎫 Creating MRFT Collection (Mogate Raffle Free Ticket)\n');
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

  if (balance < 0.1 * 1e9) {
    console.error('❌ Insufficient balance. Need at least 0.1 SOL.');
    if (NETWORK === 'devnet') {
      console.log('Get devnet SOL: solana airdrop 2');
    }
    process.exit(1);
  }

  // Check if MRFT collection already exists
  const configPath = path.join(__dirname, '../.mrft-collection.json');
  if (fs.existsSync(configPath)) {
    const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log('⚠️  MRFT collection already created!');
    console.log('Collection Mint:', existingConfig.collectionMint);
    console.log('Network:', existingConfig.network);
    console.log();
    console.log('To recreate, delete .mrft-collection.json and run again.');
    process.exit(0);
  }

  // Initialize Metaplex
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(wallet))
    .use(bundlrStorage({
      address: NETWORK === 'mainnet' 
        ? 'https://node1.bundlr.network'
        : 'https://devnet.bundlr.network',
      providerUrl: RPC_URL,
      timeout: 60000,
    }));

  console.log('📝 Step 1: Upload MRFT Metadata to Arweave');
  console.log('─'.repeat(60));

  // Upload collection metadata
  const { uri: collectionUri } = await metaplex.nfts().uploadMetadata({
    name: MRFT_CONFIG.name,
    symbol: MRFT_CONFIG.symbol,
    description: MRFT_CONFIG.description,
    image: MRFT_CONFIG.image,
    external_url: MRFT_CONFIG.externalUrl,
    attributes: [
      { trait_type: 'Type', value: 'Refund Ticket' },
      { trait_type: 'Redeemable', value: 'Yes' },
    ],
    properties: {
      category: 'image',
      files: [
        {
          uri: MRFT_CONFIG.image,
          type: 'image/png',
        },
      ],
    },
  });

  console.log('✅ Metadata uploaded to Arweave');
  console.log('URI:', collectionUri);
  console.log();

  console.log('📝 Step 2: Create MRFT Collection NFT');
  console.log('─'.repeat(60));

  // Create MRFT collection NFT
  const { nft: collection } = await metaplex.nfts().create({
    name: MRFT_CONFIG.name,
    symbol: MRFT_CONFIG.symbol,
    uri: collectionUri,
    sellerFeeBasisPoints: MRFT_CONFIG.sellerFeeBasisPoints,
    isCollection: true,
    updateAuthority: wallet,
    creators: [
      {
        address: wallet.publicKey,
        share: 100,
      },
    ],
  });

  console.log('✅ MRFT Collection NFT created');
  console.log('Collection Mint:', collection.address.toBase58());
  console.log('Update Authority:', collection.updateAuthorityAddress.toBase58());
  console.log();

  console.log('📝 Step 3: Verify MRFT Collection');
  console.log('─'.repeat(60));

  const collectionNft = await metaplex.nfts().findByMint({
    mintAddress: collection.address,
  });

  console.log('Name:', collectionNft.name);
  console.log('Symbol:', collectionNft.symbol);
  console.log('URI:', collectionNft.uri);
  console.log('Is Collection:', collectionNft.collectionDetails !== null);
  console.log();

  console.log('📝 Step 4: Save Configuration');
  console.log('─'.repeat(60));

  const config = {
    network: NETWORK,
    collectionMint: collection.address.toBase58(),
    updateAuthority: wallet.publicKey.toBase58(),
    uri: collectionUri,
    createdAt: new Date().toISOString(),
    ...MRFT_CONFIG,
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ Configuration saved to .mrft-collection.json');
  console.log();

  console.log('📝 Step 5: Update Environment Variables');
  console.log('─'.repeat(60));
  console.log('Add this to your .env file:');
  console.log();
  console.log(`MRFT_COLLECTION_MINT_${NETWORK.toUpperCase()}=${collection.address.toBase58()}`);
  console.log();

  console.log('✅ MRFT Collection Creation Complete!');
  console.log();
  console.log('Next steps:');
  console.log('1. Update .env with MRFT_COLLECTION_MINT address');
  console.log('2. Run: bun run scripts/5-delegate-mrft-authority.ts');
  console.log('3. Update programs/rwa_raffle/src/lib.rs with MRFT collection mint');
  console.log();
  console.log('💡 What is MRFT?');
  console.log('When raffles fail, users can choose to receive MRFT NFTs instead of USDC refunds.');
  console.log('MRFT can be burned to join future raffles for free (like store credit).');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
