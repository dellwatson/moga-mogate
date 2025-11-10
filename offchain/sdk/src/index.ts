import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import axios from 'axios';
import bs58 from 'bs58';

// TODO: Create separate modules for better organization
// export * from './raffle';
// export * from './directSell';
// export * from './redeem';
// export * from './utils';

/**
 * Main SDK client for Mogate RWA programs
 */
export class MogateSDK {
  constructor(
    public connection: Connection,
    public provider: AnchorProvider,
    public backendUrl: string = 'http://localhost:3000'
  ) {}

  /**
   * Create raffle with backend permit
   */
  async createRaffleWithPermit(params: {
    organizer: Keypair;
    mint: PublicKey;
    escrowAta: PublicKey;
    requiredTickets: number;
    deadline: number;
    autoDraw: boolean;
    ticketMode: number;
  }) {
    // Request permit from backend
    const permitResponse = await axios.post(`${this.backendUrl}/api/permits/raffle/create`, {
      organizer: params.organizer.publicKey.toBase58(),
      required_tickets: params.requiredTickets,
      deadline: params.deadline,
      auto_draw: params.autoDraw,
      ticket_mode: params.ticketMode,
    });

    const { nonce, expiry, signature } = permitResponse.data.permit;

    // Build ed25519 instruction
    const ed25519Ix = await this.buildEd25519Instruction(
      signature,
      this.getBackendPublicKey(),
      this.buildRafflePermitMessage({
        organizer: params.organizer.publicKey,
        nonce: Buffer.from(nonce, 'hex'),
        expiry,
        requiredTickets: params.requiredTickets,
        deadline: params.deadline,
        autoDraw: params.autoDraw,
        ticketMode: params.ticketMode,
      })
    );

    // Build initialize_raffle_with_permit instruction
    // TODO: Use actual program instance
    // const initRaffleIx = await program.methods
    //   .initializeRaffleWithPermit(
    //     new BN(params.requiredTickets),
    //     new BN(params.deadline),
    //     params.autoDraw,
    //     params.ticketMode,
    //     Array.from(Buffer.from(nonce, 'hex')),
    //     new BN(expiry)
    //   )
    //   .accounts({
    //     organizer: params.organizer.publicKey,
    //     mint: params.mint,
    //     escrowAta: params.escrowAta,
    //     // ... other accounts
    //   })
    //   .instruction();

    // const tx = new Transaction().add(ed25519Ix, initRaffleIx);
    // return await this.provider.sendAndConfirm(tx, [params.organizer]);
  }

  /**
   * Join raffle with MOGA tokens
   */
  async joinRaffleWithMoga(params: {
    payer: Keypair;
    raffle: PublicKey;
    slots: number[];
    maxMogaIn: number;
    mogaMint: PublicKey;
    usdcMint: PublicKey;
  }) {
    // Request permit from backend
    const raffleAccount = await this.fetchRaffleAccount(params.raffle);
    
    const permitResponse = await axios.post(`${this.backendUrl}/api/permits/raffle/join`, {
      raffle: params.raffle.toBase58(),
      organizer: raffleAccount.organizer.toBase58(),
      payer: params.payer.publicKey.toBase58(),
      slots: params.slots,
      moga_mint: params.mogaMint.toBase58(),
      usdc_mint: params.usdcMint.toBase58(),
    });

    const { nonce, expiry, signature } = permitResponse.data.permit;

    // Get Pyth price
    const pythPrice = await this.getPythPrice(params.mogaMint);

    // Get Jupiter quote
    const jupiterQuote = await this.getJupiterQuote({
      inputMint: params.mogaMint,
      outputMint: params.usdcMint,
      amount: params.maxMogaIn,
    });

    // Build transaction with ed25519 + join instruction + Jupiter swap
    // TODO: Implement full transaction building
  }

  /**
   * Get available slots for a raffle
   */
  async getAvailableSlots(raffle: PublicKey): Promise<number[]> {
    const slotsAccount = await this.fetchSlotsAccount(raffle);
    const availableSlots: number[] = [];

    for (let i = 0; i < slotsAccount.requiredSlots; i++) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      const isTaken = (slotsAccount.bitmap[byteIdx] & (1 << bitIdx)) !== 0;
      
      if (!isTaken) {
        availableSlots.push(i);
      }
    }

    return availableSlots;
  }

  /**
   * Estimate MOGA needed for slots
   */
  async estimateMogaForSlots(params: {
    slots: number[];
    mogaMint: PublicKey;
    usdcMint: PublicKey;
  }): Promise<{ mogaNeeded: number; usdcNeeded: number; price: number }> {
    const pythPrice = await this.getPythPrice(params.mogaMint);
    const usdcNeeded = params.slots.length * 1_000_000; // 1 USDC per slot (6 decimals)
    const mogaNeeded = Math.ceil(usdcNeeded / pythPrice);

    return {
      mogaNeeded,
      usdcNeeded,
      price: pythPrice,
    };
  }

  /**
   * Create listing with backend permit
   */
  async createListingWithPermit(params: {
    seller: Keypair;
    nftMint: PublicKey;
    price: number;
    paymentMint: PublicKey;
  }) {
    const permitResponse = await axios.post(`${this.backendUrl}/api/permits/listing/create`, {
      seller: params.seller.publicKey.toBase58(),
      nft_mint: params.nftMint.toBase58(),
      price: params.price,
      payment_mint: params.paymentMint.toBase58(),
    });

    const { nonce, expiry, signature } = permitResponse.data.permit;

    // Build transaction
    // TODO: Implement
  }

  /**
   * Redeem RWA NFT
   */
  async redeemNft(params: {
    holder: Keypair;
    nftMint: PublicKey;
    redemptionType: number;
  }) {
    const permitResponse = await axios.post(`${this.backendUrl}/api/permits/redeem`, {
      holder: params.holder.publicKey.toBase58(),
      nft_mint: params.nftMint.toBase58(),
      redemption_type: params.redemptionType,
    });

    const { nonce, expiry, signature } = permitResponse.data.permit;

    // Build transaction
    // TODO: Implement
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async fetchRaffleAccount(raffle: PublicKey): Promise<any> {
    // TODO: Fetch from program
    throw new Error('Not implemented');
  }

  private async fetchSlotsAccount(raffle: PublicKey): Promise<any> {
    // TODO: Fetch from program
    throw new Error('Not implemented');
  }

  private async getPythPrice(mint: PublicKey): Promise<number> {
    // TODO: Fetch from Pyth oracle
    // For now, return mock price
    return 5.0; // $5 per MOGA
  }

  private async getJupiterQuote(params: {
    inputMint: PublicKey;
    outputMint: PublicKey;
    amount: number;
  }): Promise<any> {
    const response = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: params.inputMint.toBase58(),
        outputMint: params.outputMint.toBase58(),
        amount: params.amount,
        slippageBps: 50, // 0.5%
      },
    });

    return response.data;
  }

  private async buildEd25519Instruction(
    signature: string,
    publicKey: PublicKey,
    message: Buffer
  ): Promise<TransactionInstruction> {
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = publicKey.toBytes();

    // Ed25519 instruction data format
    const data = Buffer.concat([
      Buffer.from([1]), // num_signatures
      Buffer.from([0]), // padding
      Buffer.from([0, 0]), // signature_offset (u16)
      Buffer.from([0, 64]), // signature_length (u16)
      Buffer.from([0, 64]), // public_key_offset (u16)
      Buffer.from([0, 32]), // public_key_length (u16)
      Buffer.from([0, 96]), // message_offset (u16)
      Buffer.from([message.length >> 8, message.length & 0xff]), // message_length (u16)
      Buffer.from([0xff, 0xff]), // message_instruction_index (u16, 0xffff = current ix)
      signatureBytes,
      publicKeyBytes,
      message,
    ]);

    return new TransactionInstruction({
      keys: [],
      programId: new PublicKey('Ed25519SigVerify111111111111111111111111111'),
      data,
    });
  }

  private buildRafflePermitMessage(params: {
    organizer: PublicKey;
    nonce: Buffer;
    expiry: number;
    requiredTickets: number;
    deadline: number;
    autoDraw: boolean;
    ticketMode: number;
  }): Buffer {
    return Buffer.concat([
      Buffer.from('RWA_RAFFLE_PERMIT'),
      params.organizer.toBuffer(),
      params.nonce,
      Buffer.from(new BigInt64Array([BigInt(params.expiry)]).buffer),
      Buffer.from(new BigUint64Array([BigInt(params.requiredTickets)]).buffer),
      Buffer.from(new BigInt64Array([BigInt(params.deadline)]).buffer),
      this.getProgramId('raffle').toBuffer(),
      Buffer.from([params.autoDraw ? 1 : 0]),
      Buffer.from([params.ticketMode]),
    ]);
  }

  private getBackendPublicKey(): PublicKey {
    // TODO: Fetch from backend /health endpoint
    return new PublicKey('2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r');
  }

  private getProgramId(program: 'raffle' | 'directSell' | 'redeem'): PublicKey {
    const ids = {
      raffle: '5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M',
      directSell: 'Di1ectSe11111111111111111111111111111111111',
      redeem: 'RwaRede3m1111111111111111111111111111111111',
    };
    return new PublicKey(ids[program]);
  }
}

/**
 * Create SDK instance
 */
export function createMogateSDK(
  connection: Connection,
  provider: AnchorProvider,
  backendUrl?: string
): MogateSDK {
  return new MogateSDK(connection, provider, backendUrl);
}
