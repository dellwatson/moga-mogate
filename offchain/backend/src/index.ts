import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Connection, Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { z } from 'zod';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// Backend ed25519 keypair for signing permits
const BACKEND_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.BACKEND_SECRET_KEY!)
);

const connection = new Connection(RPC_URL, 'confirmed');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// ============================================================================
// Permit Signing Endpoints
// ============================================================================

/**
 * POST /api/permits/raffle/create
 * 
 * Request body:
 * {
 *   organizer: string (pubkey),
 *   required_tickets: number,
 *   deadline: number (unix timestamp),
 *   auto_draw: boolean,
 *   ticket_mode: number (0-2)
 * }
 * 
 * Response:
 * {
 *   permit: {
 *     nonce: string (hex),
 *     expiry: number,
 *     signature: string (base58)
 *   }
 * }
 */
const CreateRafflePermitSchema = z.object({
  organizer: z.string(),
  required_tickets: z.number().int().positive(),
  deadline: z.number().int(),
  auto_draw: z.boolean(),
  ticket_mode: z.number().int().min(0).max(2),
});

app.post('/api/permits/raffle/create', async (req, res) => {
  try {
    const body = CreateRafflePermitSchema.parse(req.body);
    
    // TODO: Verify organizer is KYC'd and whitelisted
    // const isWhitelisted = await checkOrganizerWhitelist(body.organizer);
    // if (!isWhitelisted) {
    //   return res.status(403).json({ error: 'Organizer not whitelisted' });
    // }
    
    // Generate permit
    const nonce = Buffer.from(nacl.randomBytes(16));
    const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry
    const programId = Buffer.from(bs58.decode(process.env.RWA_RAFFLE_PROGRAM_ID!));
    
    // Build message: b"RWA_RAFFLE_PERMIT" || organizer || nonce || expiry || required_tickets || deadline || program_id || auto_draw || ticket_mode
    const message = Buffer.concat([
      Buffer.from('RWA_RAFFLE_PERMIT'),
      Buffer.from(bs58.decode(body.organizer)),
      nonce,
      Buffer.from(new BigInt64Array([BigInt(expiry)]).buffer),
      Buffer.from(new BigUint64Array([BigInt(body.required_tickets)]).buffer),
      Buffer.from(new BigInt64Array([BigInt(body.deadline)]).buffer),
      programId,
      Buffer.from([body.auto_draw ? 1 : 0]),
      Buffer.from([body.ticket_mode]),
    ]);
    
    const signature = nacl.sign.detached(message, BACKEND_KEYPAIR.secretKey);
    
    res.json({
      permit: {
        nonce: nonce.toString('hex'),
        expiry,
        signature: bs58.encode(signature),
      },
    });
  } catch (error) {
    console.error('Error creating raffle permit:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

/**
 * POST /api/permits/raffle/join
 * 
 * Request body:
 * {
 *   raffle: string (pubkey),
 *   organizer: string (pubkey),
 *   payer: string (pubkey),
 *   slots: number[],
 *   moga_mint: string (pubkey),
 *   usdc_mint: string (pubkey)
 * }
 * 
 * Response:
 * {
 *   permit: {
 *     nonce: string (hex),
 *     expiry: number,
 *     signature: string (base58),
 *     slots_hash: string (base58)
 *   }
 * }
 */
const JoinRafflePermitSchema = z.object({
  raffle: z.string(),
  organizer: z.string(),
  payer: z.string(),
  slots: z.array(z.number().int().nonnegative()),
  moga_mint: z.string(),
  usdc_mint: z.string(),
});

app.post('/api/permits/raffle/join', async (req, res) => {
  try {
    const body = JoinRafflePermitSchema.parse(req.body);
    
    // TODO: Verify payer is KYC'd and not blacklisted
    // TODO: Verify slots are still available on-chain
    
    // Compute slots hash
    const slotsBytes = Buffer.concat(
      body.slots.map(slot => Buffer.from(new Uint32Array([slot]).buffer))
    );
    const crypto = await import('crypto');
    const slotsHash = crypto.createHash('sha256').update(slotsBytes).digest();
    
    // Generate permit
    const nonce = Buffer.from(nacl.randomBytes(16));
    const expiry = Math.floor(Date.now() / 1000) + 600; // 10 minutes expiry
    const programId = Buffer.from(bs58.decode(process.env.RWA_RAFFLE_PROGRAM_ID!));
    
    // Build message
    const message = Buffer.concat([
      Buffer.from('RWA_RAFFLE_JOIN_PERMIT'),
      Buffer.from(bs58.decode(body.raffle)),
      Buffer.from(bs58.decode(body.organizer)),
      Buffer.from(bs58.decode(body.payer)),
      slotsHash,
      Buffer.from(bs58.decode(body.moga_mint)),
      Buffer.from(bs58.decode(body.usdc_mint)),
      nonce,
      Buffer.from(new BigInt64Array([BigInt(expiry)]).buffer),
      programId,
    ]);
    
    const signature = nacl.sign.detached(message, BACKEND_KEYPAIR.secretKey);
    
    res.json({
      permit: {
        nonce: nonce.toString('hex'),
        expiry,
        signature: bs58.encode(signature),
        slots_hash: bs58.encode(slotsHash),
      },
    });
  } catch (error) {
    console.error('Error creating join permit:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

/**
 * POST /api/permits/listing/create
 * 
 * Request body:
 * {
 *   seller: string (pubkey),
 *   nft_mint: string (pubkey),
 *   price: number,
 *   payment_mint: string (pubkey)
 * }
 */
const CreateListingPermitSchema = z.object({
  seller: z.string(),
  nft_mint: z.string(),
  price: z.number().int().positive(),
  payment_mint: z.string(),
});

app.post('/api/permits/listing/create', async (req, res) => {
  try {
    const body = CreateListingPermitSchema.parse(req.body);
    
    // TODO: Verify seller owns NFT
    // TODO: Verify NFT is from approved collection
    
    const nonce = Buffer.from(nacl.randomBytes(16));
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const programId = Buffer.from(bs58.decode(process.env.DIRECT_SELL_PROGRAM_ID!));
    
    const message = Buffer.concat([
      Buffer.from('DIRECT_SELL_CREATE_PERMIT'),
      Buffer.from(bs58.decode(body.seller)),
      Buffer.from(bs58.decode(body.nft_mint)),
      Buffer.from(new BigUint64Array([BigInt(body.price)]).buffer),
      Buffer.from(bs58.decode(body.payment_mint)),
      nonce,
      Buffer.from(new BigInt64Array([BigInt(expiry)]).buffer),
      programId,
    ]);
    
    const signature = nacl.sign.detached(message, BACKEND_KEYPAIR.secretKey);
    
    res.json({
      permit: {
        nonce: nonce.toString('hex'),
        expiry,
        signature: bs58.encode(signature),
      },
    });
  } catch (error) {
    console.error('Error creating listing permit:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

/**
 * POST /api/permits/redeem
 * 
 * Request body:
 * {
 *   holder: string (pubkey),
 *   nft_mint: string (pubkey),
 *   redemption_type: number (0-2)
 * }
 */
const RedeemPermitSchema = z.object({
  holder: z.string(),
  nft_mint: z.string(),
  redemption_type: z.number().int().min(0).max(2),
});

app.post('/api/permits/redeem', async (req, res) => {
  try {
    const body = RedeemPermitSchema.parse(req.body);
    
    // TODO: Verify holder owns NFT
    // TODO: Verify NFT is redeemable (not already redeemed)
    // TODO: Verify holder's shipping address (for physical delivery)
    
    const nonce = Buffer.from(nacl.randomBytes(16));
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const programId = Buffer.from(bs58.decode(process.env.RWA_REDEEM_PROGRAM_ID!));
    
    const message = Buffer.concat([
      Buffer.from('RWA_REDEEM_PERMIT'),
      Buffer.from(bs58.decode(body.holder)),
      Buffer.from(bs58.decode(body.nft_mint)),
      Buffer.from([body.redemption_type]),
      nonce,
      Buffer.from(new BigInt64Array([BigInt(expiry)]).buffer),
      programId,
    ]);
    
    const signature = nacl.sign.detached(message, BACKEND_KEYPAIR.secretKey);
    
    res.json({
      permit: {
        nonce: nonce.toString('hex'),
        expiry,
        signature: bs58.encode(signature),
      },
    });
  } catch (error) {
    console.error('Error creating redeem permit:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    backend_pubkey: BACKEND_KEYPAIR.publicKey.toBase58(),
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Backend pubkey: ${BACKEND_KEYPAIR.publicKey.toBase58()}`);
  console.log(`RPC URL: ${RPC_URL}`);
});
