import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import dotenv from 'dotenv';
import bs58 from 'bs58';
import crypto from 'crypto';

dotenv.config();

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const WORKER_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.WORKER_SECRET_KEY!)
);
const RWA_RAFFLE_PROGRAM_ID = new PublicKey(process.env.RWA_RAFFLE_PROGRAM_ID!);

const connection = new Connection(RPC_URL, 'confirmed');
const wallet = new Wallet(WORKER_KEYPAIR);
const provider = new AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
});

// TODO: Load IDL and create program instance
// const program = new Program(idl, RWA_RAFFLE_PROGRAM_ID, provider);

console.log('Worker started');
console.log('Worker pubkey:', WORKER_KEYPAIR.publicKey.toBase58());
console.log('RPC URL:', RPC_URL);

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Listen for RandomnessRequested events and trigger auto-draw
 */
async function listenForRandomnessRequested() {
  console.log('Listening for RandomnessRequested events...');
  
  // TODO: Subscribe to program logs
  // connection.onLogs(RWA_RAFFLE_PROGRAM_ID, async (logs) => {
  //   if (logs.logs.some(log => log.includes('RandomnessRequested'))) {
  //     const raffleAddress = extractRaffleAddress(logs);
  //     await handleRandomnessRequested(raffleAddress);
  //   }
  // });
  
  // Polling fallback (for development)
  setInterval(async () => {
    try {
      await pollForPendingDraws();
    } catch (error) {
      console.error('Error polling for pending draws:', error);
    }
  }, 30000); // Poll every 30 seconds
}

/**
 * Poll for raffles in Drawing status that need randomness
 */
async function pollForPendingDraws() {
  console.log('Polling for pending draws...');
  
  // TODO: Fetch all raffle accounts with status = Drawing
  // const raffles = await program.account.raffle.all([
  //   {
  //     memcmp: {
  //       offset: 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8, // Offset to status field
  //       bytes: bs58.encode([1]), // RaffleStatus::Drawing
  //     },
  //   },
  // ]);
  
  // for (const raffle of raffles) {
  //   if (raffle.account.autoDrawand !raffle.account.winnerTicket) {
  //     await handleRandomnessRequested(raffle.publicKey);
  //   }
  // }
}

/**
 * Handle RandomnessRequested event
 */
async function handleRandomnessRequested(raffleAddress: PublicKey) {
  console.log(`Processing randomness request for raffle: ${raffleAddress.toBase58()}`);
  
  try {
    // TODO: Fetch raffle account
    // const raffle = await program.account.raffle.fetch(raffleAddress);
    
    // Generate random winner ticket (1 to required_tickets)
    // In production, use VRF or secure randomness source
    const requiredTickets = 100; // raffle.requiredTickets
    const winnerTicket = generateRandomWinner(requiredTickets);
    
    console.log(`Generated winner ticket: ${winnerTicket}`);
    
    // Call settle_draw instruction
    // await program.methods
    //   .settleDraw(new BN(winnerTicket))
    //   .accounts({
    //     organizer: raffle.organizer,
    //     raffle: raffleAddress,
    //   })
    //   .rpc();
    
    console.log(`Successfully settled draw for raffle: ${raffleAddress.toBase58()}`);
  } catch (error) {
    console.error(`Error handling randomness request:`, error);
  }
}

/**
 * Generate random winner ticket using SHA256
 * 
 * In production, use:
 * - Switchboard VRF
 * - Pyth Entropy
 * - Chainlink VRF (when available on Solana)
 * - Or secure off-chain VRF with proof
 */
function generateRandomWinner(maxTicket: number): number {
  // Use current slot + timestamp + random bytes for entropy
  const entropy = Buffer.concat([
    Buffer.from(Date.now().toString()),
    crypto.randomBytes(32),
  ]);
  
  const hash = crypto.createHash('sha256').update(entropy).digest();
  const randomValue = hash.readUInt32BE(0);
  
  // Map to ticket range [1, maxTicket]
  return (randomValue % maxTicket) + 1;
}

// ============================================================================
// Refund Processing
// ============================================================================

/**
 * Listen for raffles that passed deadline without reaching threshold
 * and automatically trigger refunds
 */
async function listenForRefundableRaffles() {
  console.log('Listening for refundable raffles...');
  
  setInterval(async () => {
    try {
      await pollForRefundableRaffles();
    } catch (error) {
      console.error('Error polling for refundable raffles:', error);
    }
  }, 60000); // Poll every minute
}

async function pollForRefundableRaffles() {
  const now = Math.floor(Date.now() / 1000);
  
  // TODO: Fetch raffles with status = Selling and deadline < now
  // const raffles = await program.account.raffle.all([
  //   {
  //     memcmp: {
  //       offset: 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8,
  //       bytes: bs58.encode([0]), // RaffleStatus::Selling
  //     },
  //   },
  // ]);
  
  // for (const raffle of raffles) {
  //   if (raffle.account.deadline < now && raffle.account.ticketsSold < raffle.account.requiredTickets) {
  //     await triggerRefund(raffle.publicKey);
  //   }
  // }
}

async function triggerRefund(raffleAddress: PublicKey) {
  console.log(`Triggering refund for raffle: ${raffleAddress.toBase58()}`);
  
  try {
    // Call request_refund instruction
    // await program.methods
    //   .requestRefund()
    //   .accounts({
    //     organizer: raffle.organizer,
    //     raffle: raffleAddress,
    //   })
    //   .rpc();
    
    console.log(`Successfully triggered refund for raffle: ${raffleAddress.toBase58()}`);
  } catch (error) {
    console.error(`Error triggering refund:`, error);
  }
}

// ============================================================================
// Redemption Processing
// ============================================================================

/**
 * Listen for RedemptionRequested events and process fulfillment
 */
async function listenForRedemptions() {
  console.log('Listening for redemption requests...');
  
  // TODO: Subscribe to RWA_REDEEM program logs
  // connection.onLogs(RWA_REDEEM_PROGRAM_ID, async (logs) => {
  //   if (logs.logs.some(log => log.includes('RedemptionRequested'))) {
  //     const redemptionAddress = extractRedemptionAddress(logs);
  //     await handleRedemptionRequest(redemptionAddress);
  //   }
  // });
}

async function handleRedemptionRequest(redemptionAddress: PublicKey) {
  console.log(`Processing redemption: ${redemptionAddress.toBase58()}`);
  
  // TODO: Fetch redemption account
  // const redemption = await redeemProgram.account.redemption.fetch(redemptionAddress);
  
  // Based on redemption_type:
  // 0: Physical delivery - create shipping order
  // 1: Digital delivery - send digital asset
  // 2: Cash settlement - initiate payment
  
  // After fulfillment, call mark_fulfilled
  // await redeemProgram.methods
  //   .markFulfilled(fulfillmentData)
  //   .accounts({
  //     authority: WORKER_KEYPAIR.publicKey,
  //     redemption: redemptionAddress,
  //   })
  //   .rpc();
}

// ============================================================================
// Start Worker
// ============================================================================

async function main() {
  console.log('Starting worker services...');
  
  // Start event listeners
  listenForRandomnessRequested();
  listenForRefundableRaffles();
  listenForRedemptions();
  
  console.log('Worker services started successfully');
}

main().catch(console.error);
