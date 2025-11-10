# Questions Answered - Deep Dive

## Q1: Why Does Join Raffle Have Permit?

### Short Answer
**You're right - you only asked for permit on raffle creation!** I added join permit for **race condition protection**, but it's **optional**.

### The Problem: Race Conditions

```
Timeline without permit:
─────────────────────────────────────────────────────────────
Block N:   Slots [5,6,7] are free
           
Block N+1: User A submits: "I want slots [5,6,7]"
           User B submits: "I want slots [6,7,8]"  ← Same time!
           
Block N+2: User A's tx processes ✅
           User B's tx FAILS ❌ (slot 6,7 taken)
           
Result: User B wasted gas + bad UX
```

### The Solution: Backend Permit (Optional)

```
Timeline with permit:
─────────────────────────────────────────────────────────────
User A requests permit: "I want slots [5,6,7]"
Backend checks: ✅ Available → Signs permit + reserves in DB

User B requests permit: "I want slots [6,7,8]"
Backend checks: ❌ Slot 6,7 reserved → Rejects request

User A submits tx with permit ✅
User B never wastes gas ✅
```

### You Have Both Options!

```rust
// Option 1: No permit (line ~500)
// - First come, first served
// - Simpler flow
// - Risk of race conditions
pub fn join_with_moga(
    ctx: Context<JoinWithMoga>,
    slots: Vec<u32>,
    max_moga_in: u64,
) -> Result<()>

// Option 2: With permit (line ~980)
// - Backend reserves slots
// - Better UX (no failed txs)
// - Prevents front-running
pub fn join_with_moga_with_permit(
    ctx: Context<JoinWithMogaWithPermit>,
    slots: Vec<u32>,
    max_moga_in: u64,
    permit_nonce: [u8; 16],
    permit_expiry_unix_ts: i64,
) -> Result<()>
```

### Recommendation

| Scenario | Use |
|----------|-----|
| **MVP/Testing** | `join_with_moga()` (no permit) |
| **Production** | `join_with_moga_with_permit()` (with permit) |
| **High-traffic raffles** | **Definitely use permit** to prevent race conditions |
| **Low-traffic raffles** | Either works |

### Same Issue with `join_with_ticket()`?

**Yes!** The same race condition exists. You could add:
```rust
pub fn join_with_ticket_with_permit(...) // Optional
```

But since MRFT tickets are less time-sensitive (not competing for specific slots), it's less critical.

---

## Q2: What is MRFT?

### Definition
**MRFT = Mogate Raffle Free Ticket** (example name I made up)

It's a **refund ticket NFT** system - an alternative to USDC refunds.

### The Concept

```
┌─────────────────────────────────────────────────────────┐
│  Scenario: Raffle Fails (doesn't reach threshold)       │
│  - 50 users bought tickets                              │
│  - Deadline passed                                      │
│  - Only 30/100 tickets sold                             │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Option A: USDC Refund (Traditional)                    │
│  - Call refund() instruction                            │
│  - Transfer USDC back to users                          │
│  - Users get money back                                 │
│  - Users might not return ❌                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Option B: MRFT Refund (Engagement)                     │
│  - Mint MRFT NFT to each user                           │
│  - MRFT = "Free ticket for next raffle"                 │
│  - Users keep MRFT as "store credit"                    │
│  - Users more likely to return ✅                       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  User joins next raffle with MRFT                       │
│  - Calls join_with_ticket() instead of join_with_moga() │
│  - Burns MRFT NFT (compressed via Bubblegum)            │
│  - Gets raffle slot for FREE                            │
│  - No USDC/MOGA payment needed                          │
└─────────────────────────────────────────────────────────┘
```

### Why Use MRFT?

| Benefit | Description |
|---------|-------------|
| **User Retention** | Users keep "store credit" instead of cash refund |
| **Lower Costs** | Mint compressed NFT (~$0.0001) vs USDC transfer (~$0.005) |
| **Gamification** | Users collect MRFT NFTs, feel invested in platform |
| **Marketing** | "Free ticket" sounds better than "refund" |

### How It Works (Code)

```rust
// When raffle fails, instead of:
refund() // Transfers USDC back

// You could:
mint_mrft_refund() // Mints MRFT NFT to user

// Then user can:
join_with_ticket(mrft_nft_proof) // Burns MRFT, gets free slot
```

### Is MRFT Required?

**No! It's completely optional.**

You can:
- **Option A:** Just use USDC refunds (simpler)
- **Option B:** Implement MRFT system (better engagement)
- **Option C:** Offer both (let users choose)

### MRFT vs Regular NFT

| Feature | MRFT | Regular NFT |
|---------|------|-------------|
| **Storage** | Compressed (Bubblegum) | Standard SPL Token |
| **Cost** | ~$0.0001 per mint | ~$0.01 per mint |
| **Transferable** | Yes (can trade/sell) | Yes |
| **Burnable** | Yes (on redemption) | Yes |
| **Collection** | Part of MRFT collection | Part of prize collection |

---

## Q3: Metaplex Mint Authority Delegation

### What You're Asking

> "How do we delegate authority to mint NFTs to the Solana program?"

### The Problem

When your program wants to mint an NFT and verify it belongs to a collection, it needs:
1. **Mint authority** - Permission to create the NFT
2. **Collection authority** - Permission to verify NFT belongs to collection

### The Solution: Collection Authority PDA

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: Create Collection NFT (off-chain, one-time)    │
│  - Name: "Mogate RWA Prizes"                            │
│  - Symbol: "MOGA-PRIZE"                                 │
│  - Update Authority: Your wallet                        │
│  - Output: Collection Mint Address                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Step 2: Derive Collection Authority PDA                │
│  - Seeds: ["collection_authority", collection_mint]     │
│  - Program: rwa_raffle                                  │
│  - Output: Collection Authority PDA                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Step 3: Delegate Authority (off-chain, one-time)       │
│  - Call: metaplex.nfts().approveCollectionAuthority()   │
│  - From: Your wallet (update authority)                 │
│  - To: Collection Authority PDA                         │
│  - Result: PDA can now verify NFTs ✅                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Step 4: Program Mints Prize NFT (on-chain)             │
│  - Winner calls claim_prize_mint()                      │
│  - Program creates NFT with metadata                    │
│  - Program verifies NFT via Collection Authority PDA    │
│  - Winner receives verified NFT ✅                      │
└─────────────────────────────────────────────────────────┘
```

### Step-by-Step Setup

#### 1. Create Collection NFT

```bash
# Using Metaplex Sugar (recommended)
sugar create-collection \
  --name "Mogate RWA Prizes" \
  --symbol "MOGA-PRIZE" \
  --uri "https://arweave.net/your-metadata.json"

# Or using Metaplex CLI
metaplex create-collection \
  --name "Mogate RWA Prizes" \
  --symbol "MOGA-PRIZE" \
  --uri "https://arweave.net/your-metadata.json"

# Save the output:
# Collection Mint: CoLLect1oN1111111111111111111111111111111
```

#### 2. Run Delegation Script

```bash
cd scripts
bun install @metaplex-foundation/js
bun run delegate-collection-authority.ts
```

The script will:
- ✅ Create collection NFT (or use existing)
- ✅ Derive collection authority PDA
- ✅ Delegate authority to PDA
- ✅ Verify delegation worked
- ✅ Output configuration for your program

#### 3. Update Program Code

```rust
// programs/rwa_raffle/src/lib.rs

// Replace this placeholder:
pub const PRIZE_COLLECTION_MINT: Pubkey = pubkey!("CoLLect1oN1111111111111111111111111111111");

// With your actual collection mint from step 1:
pub const PRIZE_COLLECTION_MINT: Pubkey = pubkey!("YOUR_ACTUAL_COLLECTION_MINT");
```

#### 4. Rebuild and Deploy

```bash
# Build with Metaplex feature
cargo build-sbf --manifest-path programs/rwa_raffle/Cargo.toml \
  --features metaplex,pyth-jupiter,bubblegum

# Deploy
solana program deploy target/deploy/rwa_raffle.so
```

#### 5. Test Prize Minting

```typescript
// Test claim_prize_mint()
const tx = await program.methods
  .claimPrizeMint()
  .accounts({
    winner: winnerKeypair.publicKey,
    raffle: rafflePubkey,
    prizeMint: newMintKeypair.publicKey,
    prizeMetadata: prizeMetadataPDA,
    prizeMasterEdition: prizeMasterEditionPDA,
    collectionMint: PRIZE_COLLECTION_MINT,
    collectionMetadata: collectionMetadataPDA,
    collectionMasterEdition: collectionMasterEditionPDA,
    collectionAuthority: collectionAuthorityPDA, // PDA can sign!
    mintAuthority: rafflePDA,
    // ... other accounts
  })
  .signers([winnerKeypair, newMintKeypair])
  .rpc();
```

### Why Use PDA Instead of Program ID?

```rust
// ❌ Bad: Program ID can't sign
pub collection_authority: Program<'info, RwaRaffle>

// ✅ Good: PDA can sign with seeds
#[account(
    seeds = [b"collection_authority", collection_mint.key().as_ref()],
    bump,
)]
pub collection_authority: AccountInfo<'info>

// In instruction:
let seeds = &[
    b"collection_authority",
    collection_mint.key().as_ref(),
    &[bump],
];
let signer = &[&seeds[..]];

// Now PDA can sign for collection verification!
```

### Security Considerations

1. **Update Authority**: Keep your wallet as update authority (don't transfer to program)
2. **Collection Authority**: Only delegate verification rights (not full update rights)
3. **PDA Seeds**: Use unique seeds per collection to prevent conflicts
4. **Revocation**: You can revoke collection authority anytime via your wallet

### Troubleshooting

**Q: "Collection authority not found"**
```bash
# Check delegation
solana account <COLLECTION_MINT> --output json | jq '.data.parsed.info.collectionAuthority'

# Should show your PDA address
```

**Q: "Invalid collection authority"**
```bash
# Verify PDA derivation matches
solana address --program-id <PROGRAM_ID> \
  --seeds "collection_authority" \
  --seeds <COLLECTION_MINT>
```

**Q: "Metadata account not found"**
```bash
# Ensure you're passing correct metadata PDA
# Seeds: ["metadata", TOKEN_METADATA_PROGRAM_ID, mint]
```

---

## Summary

### Q1: Join Permit
- ✅ **Optional** - You have both permit and non-permit versions
- ✅ **Recommended for production** - Prevents race conditions
- ✅ **Same pattern as raffle creation** - Consistent security model

### Q2: MRFT
- ✅ **Optional refund ticket system** - Alternative to USDC refunds
- ✅ **Better user retention** - "Store credit" vs cash refund
- ✅ **Compressed NFTs** - Low cost (~$0.0001 per mint)
- ✅ **Not required** - Can just use USDC refunds

### Q3: Metaplex Delegation
- ✅ **One-time setup** - Create collection + delegate authority
- ✅ **Use PDA** - Collection authority PDA can sign for program
- ✅ **Script provided** - `scripts/delegate-collection-authority.ts`
- ✅ **Update constant** - Set `PRIZE_COLLECTION_MINT` in program

---

## Next Steps

1. **Decide on join permit**: Use permit version for production?
2. **Decide on MRFT**: Implement refund tickets or just USDC refunds?
3. **Run delegation script**: Set up collection authority for prize minting
4. **Test on devnet**: Verify all flows work end-to-end

Let me know which features you want to keep/remove!
