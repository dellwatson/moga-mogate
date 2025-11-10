# Collection NFT System - Complete Explanation

## 🎯 The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│  PLATFORM OWNER (YOU) - One-time setup                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Create Collection NFT (off-chain, Metaplex standard)        │
│     → Collection Mint: CoLLect1oN111...                         │
│     → This is a REGULAR NFT, not Bubblegum                      │
│     → Acts as "parent" for all prize NFTs                       │
│                                                                  │
│  2. Delegate authority to program PDA (off-chain, one-time)     │
│     → Allows program to verify prize NFTs                       │
│     → PDA can sign "this NFT belongs to collection"             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ORGANIZER - Creates raffle                                     │
├─────────────────────────────────────────────────────────────────┤
│  3. Call initialize_raffle_with_permit()                        │
│     → Passes collection_mint: CoLLect1oN111...                  │
│     → Stored in raffle.prize_collection_mint                    │
│     → Organizer chooses which collection to use                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  WINNER - Claims prize                                          │
├─────────────────────────────────────────────────────────────────┤
│  4. Call claim_prize_mint()                                     │
│     → Program reads raffle.prize_collection_mint                │
│     → Program mints NEW prize NFT                               │
│     → Program verifies it belongs to collection                 │
│     → Winner receives verified NFT ✅                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Q1: Is this in raffle_rwa program or Collection NFT program?

**Neither!** Let me break it down:

### Collection NFT (Standard Metaplex)
```
What: Regular Metaplex NFT (NOT Bubblegum, NOT in your program)
Where: Created off-chain using Metaplex CLI/SDK
Who creates: Platform owner (YOU)
When: One-time setup, before any raffles
Cost: ~$0.01 (one-time)
Purpose: Acts as "parent" for all prize NFTs
```

### Prize NFTs (Minted by your program)
```
What: New NFTs minted when winner claims
Where: Created on-chain by your raffle program
Who creates: Your program (via Metaplex CPI)
When: When winner calls claim_prize_mint()
Cost: ~$0.01 per prize (or ~$0.0001 if compressed)
Purpose: Actual prize given to winner
```

### Your Raffle Program
```
What: Solana program that manages raffles
Where: Deployed on-chain
Who creates: You (developer)
When: Deployed once, used many times
Purpose: Manages raffle logic + mints prize NFTs
```

---

## Q2: Where's the update in the code?

I've updated the code so **organizers pass the collection mint when creating a raffle**:

### Before (Confusing ❌)
```rust
// Client had to pass collection_mint every time they claimed
pub struct ClaimPrizeMint<'info> {
    pub collection_mint: InterfaceAccount<'info, Mint>, // ❌ Where does this come from?
}
```

### After (Clear ✅)
```rust
// Organizer sets collection_mint when creating raffle
pub fn initialize_raffle_with_permit(
    ctx: Context<InitializeRaffleWithPermit>,
    // ... other params ...
    prize_collection_mint: Pubkey, // ✅ Organizer provides this
    refund_mode: u8,
) -> Result<()> {
    raffle.prize_collection_mint = prize_collection_mint; // ✅ Stored in raffle
    raffle.refund_mode = refund_mode;
}

// When claiming, program reads from raffle config
pub fn claim_prize_mint(ctx: Context<ClaimPrizeMint>) -> Result<()> {
    let raffle = &ctx.accounts.raffle;
    
    // ✅ Verify collection mint matches raffle config
    require_keys_eq!(
        ctx.accounts.collection_mint.key(),
        raffle.prize_collection_mint, // ✅ From raffle config
    );
}
```

---

## Q3: Deploy with collection PDA? Setup flow?

### Complete Setup Flow

#### Step 1: Platform Owner Creates Collection (One-time)

```bash
# Run ONCE as platform owner
cd scripts
bun run delegate-collection-authority.ts

# This will:
# 1. Create collection NFT "Mogate RWA Prizes"
# 2. Derive collection authority PDA
# 3. Delegate authority to PDA
# 4. Output collection mint address

# Example output:
# Collection Mint: CoLLect1oN1111111111111111111111111111111
# Collection Authority PDA: Auth0r1tyPDA111111111111111111111111111
```

#### Step 2: Deploy Program (One-time)

```bash
# Build and deploy your program
cargo build-sbf --features metaplex,pyth-jupiter
solana program deploy target/deploy/rwa_raffle.so

# Program ID: 5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M
```

#### Step 3: Organizer Creates Raffle (Every raffle)

```typescript
// Organizer creates raffle via your backend
const collectionMint = new PublicKey('CoLLect1oN1111111111111111111111111111111');
const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

await program.methods
  .initializeRaffleWithPermit(
    requiredTickets,
    deadlineUnixTs,
    permitNonce,
    permitExpiry,
    autoDraw,
    ticketMode,
    collectionMint,  // ✅ Organizer provides collection mint
    refundMode,      // ✅ 0=USDC, 1=MRFT, 2=both
  )
  .accounts({
    organizer: organizerKeypair.publicKey,
    raffle: rafflePDA,
    mint: usdcMint,  // ✅ Organizer chooses stable coin (USDC, USDT, etc.)
    escrowAta: escrowATA,
    slots: slotsPDA,
    // ...
  })
  .rpc();
```

#### Step 4: Winner Claims Prize (When raffle completes)

```typescript
// Winner claims prize
const [collectionAuthority] = PublicKey.findProgramAddressSync(
  [Buffer.from('collection_authority'), raffle.prizeCollectionMint.toBuffer()],
  programId
);

await program.methods
  .claimPrizeMint()
  .accounts({
    winner: winnerKeypair.publicKey,
    raffle: rafflePDA,
    prizeMint: newMintKeypair.publicKey,
    prizeMetadata: prizeMetadataPDA,
    prizeMasterEdition: prizeMasterEditionPDA,
    collectionMint: raffle.prizeCollectionMint, // ✅ From raffle config
    collectionMetadata: collectionMetadataPDA,
    collectionMasterEdition: collectionMasterEditionPDA,
    collectionAuthority: collectionAuthority, // ✅ PDA can sign
    // ...
  })
  .signers([winnerKeypair, newMintKeypair])
  .rpc();
```

---

## Q4: How does collection_mint.key() look like?

```rust
// In your program
pub struct ClaimPrizeMint<'info> {
    pub collection_mint: InterfaceAccount<'info, Mint>,
}

// collection_mint.key() returns Pubkey
// Example: CoLLect1oN1111111111111111111111111111111

// collection_mint.key().as_ref() returns &[u8; 32]
// Example: [12, 34, 56, 78, ...] (32 bytes)

// Used for PDA derivation:
let [collection_authority, bump] = PublicKey::findProgramAddressSync(
  [
    b"collection_authority",
    collection_mint.key().as_ref(), // ← This is the 32-byte array
  ],
  program_id
);
```

---

## Q5: Can delegate to multiple programs?

**Yes!** You can delegate collection authority to multiple programs:

```typescript
// Delegate to raffle program
await metaplex.nfts().approveCollectionAuthority({
  mintAddress: collectionMint,
  collectionAuthority: raffleCollectionAuthorityPDA,
  updateAuthority: wallet,
});

// Delegate to direct_sell program
await metaplex.nfts().approveCollectionAuthority({
  mintAddress: collectionMint,
  collectionAuthority: directSellCollectionAuthorityPDA,
  updateAuthority: wallet,
});

// Check all delegated authorities
const collectionNft = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
const authorities = collectionNft.collectionDetails?.approvedCollectionAuthorities || [];

console.log('Delegated authorities:', authorities.map(a => a.address.toBase58()));
// Output:
// [
//   'Auth0r1tyPDA111111111111111111111111111', // raffle program
//   'Auth0r1tyPDA222222222222222222222222222', // direct_sell program
// ]
```

### Delegation Scopes

Metaplex collection authority can only:
- ✅ **Verify** NFTs belong to collection
- ✅ **Unverify** NFTs from collection

It **CANNOT**:
- ❌ Mint NFTs (program does this separately)
- ❌ Burn NFTs (requires NFT owner signature)
- ❌ Update collection metadata (requires update authority)
- ❌ Transfer collection NFT (requires owner signature)

**So delegation is safe!** The program can only verify/unverify, not steal or modify.

---

## Q6: Refund Mode - USDC vs MRFT

I've added `refund_mode` to raffle config:

```rust
pub struct Raffle {
    // ...
    pub refund_mode: u8, // 0=USDC refund, 1=MRFT mint, 2=both (user choice)
}
```

### Refund Mode Options

```typescript
// Mode 0: USDC Refund (Traditional)
refund_mode: 0

// When raffle fails:
await program.methods.refund().rpc();
// → Transfers USDC back to user
// → User gets money back
// → Simple, but users might not return

// Mode 1: MRFT Mint (Engagement)
refund_mode: 1

// When raffle fails:
await program.methods.mintMrftRefund().rpc();
// → Mints MRFT NFT to user
// → User keeps "free ticket" for next raffle
// → Better retention, gamification

// Mode 2: Both (User Choice)
refund_mode: 2

// When raffle fails:
await program.methods.refund().rpc();          // User chooses USDC
await program.methods.mintMrftRefund().rpc();  // User chooses MRFT
// → User decides which they prefer
// → Most flexible
```

### Implementation

```rust
pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let raffle = &ctx.accounts.raffle;
    
    // Check refund mode allows USDC refunds
    require!(
        raffle.refund_mode == 0 || raffle.refund_mode == 2,
        RaffleError::RefundModeNotAllowed
    );
    
    // Transfer USDC back to user
    // ...
}

pub fn mint_mrft_refund(ctx: Context<MintMrftRefund>) -> Result<()> {
    let raffle = &ctx.accounts.raffle;
    
    // Check refund mode allows MRFT mints
    require!(
        raffle.refund_mode == 1 || raffle.refund_mode == 2,
        RaffleError::RefundModeNotAllowed
    );
    
    // Mint MRFT NFT to user
    // ...
}
```

---

## Q7: Dynamic Stable Coin Address

**Already supported!** The organizer provides the stable coin mint when creating raffle:

```typescript
// Organizer can choose ANY stable coin
const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
const usdtMint = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'); // USDT
const daiMint = new PublicKey('EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o');  // DAI

await program.methods
  .initializeRaffleWithPermit(
    // ...
    prize_collection_mint,
    refund_mode,
  )
  .accounts({
    mint: usdcMint, // ✅ Organizer chooses which stable coin
    // ...
  })
  .rpc();

// Stored in raffle.mint
// All payments/refunds use this mint
```

### No Liquidity Check Needed

You don't need to check if the stable coin has liquidity because:

1. **Users pay with MOGA** → Jupiter swaps MOGA → stable coin
2. **Jupiter handles liquidity** → If no liquidity, swap fails (user sees error before tx)
3. **Organizer receives stable coin** → From escrow after raffle completes
4. **Refunds use same stable coin** → Already in escrow, no swap needed

---

## Summary

### What You Need to Do

1. **One-time setup (Platform Owner)**
   ```bash
   bun run scripts/delegate-collection-authority.ts
   # Outputs: Collection Mint address
   ```

2. **Organizer creates raffle**
   ```typescript
   initialize_raffle_with_permit(
     // ...
     prize_collection_mint: 'CoLLect1oN111...', // From step 1
     refund_mode: 2, // 0=USDC, 1=MRFT, 2=both
   )
   ```

3. **Winner claims prize**
   ```typescript
   claim_prize_mint()
   // Program reads raffle.prize_collection_mint
   // Program mints + verifies NFT
   ```

### Key Points

- ✅ **Collection NFT** = Standard Metaplex NFT (not Bubblegum, not in your program)
- ✅ **Prize NFTs** = Minted by your program when winner claims
- ✅ **Collection mint** = Stored in raffle config (organizer provides)
- ✅ **Delegation** = Safe (only verify/unverify, no mint/burn/transfer)
- ✅ **Multiple programs** = Can delegate to raffle + direct_sell
- ✅ **Refund mode** = Organizer chooses USDC/MRFT/both
- ✅ **Stable coin** = Organizer chooses which one (USDC/USDT/DAI/etc.)
- ✅ **No liquidity check** = Jupiter handles it during swap

---

## Next Steps

1. Run `bun run scripts/delegate-collection-authority.ts` to create collection
2. Update your backend to pass `prize_collection_mint` when creating raffles
3. Test claim_prize_mint() on devnet
4. Decide on default refund_mode (recommend mode 2 for flexibility)
