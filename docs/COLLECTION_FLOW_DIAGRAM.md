# Collection NFT Flow - Visual Diagram

## 🎨 The Complete Picture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLATFORM OWNER (YOU)                                 │
│                         One-time Setup                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1. Create Collection NFT
                                    ▼
                    ┌───────────────────────────────┐
                    │   Collection NFT              │
                    │   "Mogate RWA Prizes"         │
                    │                               │
                    │   Mint: CoLLect1oN111...      │
                    │   Type: Standard Metaplex     │
                    │   NOT Bubblegum               │
                    │   NOT in your program         │
                    └───────────────┬───────────────┘
                                    │
                                    │ 2. Delegate authority
                                    ▼
                    ┌───────────────────────────────┐
                    │   Collection Authority PDA    │
                    │   Auth0r1tyPDA111...          │
                    │                               │
                    │   Seeds:                      │
                    │   ["collection_authority",    │
                    │    collection_mint]           │
                    │                               │
                    │   Can: Verify NFTs            │
                    │   Cannot: Mint/Burn/Transfer  │
                    └───────────────┬───────────────┘
                                    │
                                    │ Authority delegated ✅
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                                                                            │
│                         ORGANIZER CREATES RAFFLE                           │
│                         (Multiple times)                                   │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 3. initialize_raffle_with_permit()
                                    ▼
        ┌───────────────────────────────────────────────────────┐
        │   Raffle Account                                      │
        │   ─────────────────────────────────────────────       │
        │   organizer: OrgAn1zer111...                          │
        │   mint: USDC/USDT/DAI (organizer chooses)             │
        │   prize_collection_mint: CoLLect1oN111... ◄───────────┼─── From step 1
        │   refund_mode: 2 (USDC or MRFT, user choice)          │
        │   required_tickets: 100                               │
        │   deadline: 1699999999                                │
        │   ...                                                 │
        └───────────────────────────┬───────────────────────────┘
                                    │
                                    │ Raffle created ✅
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                                                                            │
│                         USERS BUY TICKETS                                  │
│                         (Multiple users)                                   │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 4. join_with_moga()
                                    ▼
        ┌───────────────────────────────────────────────────────┐
        │   User pays MOGA                                      │
        │   ↓                                                   │
        │   Jupiter swaps MOGA → USDC                           │
        │   ↓                                                   │
        │   USDC goes to raffle escrow                          │
        │   ↓                                                   │
        │   User gets ticket                                    │
        └───────────────────────────┬───────────────────────────┘
                                    │
                                    │ Tickets sold ✅
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                                                                            │
│                         RAFFLE COMPLETES                                   │
│                         (Automatic or manual draw)                         │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 5. draw_winner() / arcium_draw()
                                    ▼
        ┌───────────────────────────────────────────────────────┐
        │   Winner selected: User123                            │
        │   Raffle status: Completed                            │
        └───────────────────────────┬───────────────────────────┘
                                    │
                                    │ Winner determined ✅
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                                                                            │
│                         WINNER CLAIMS PRIZE                                │
│                         (Winner calls claim_prize_mint)                    │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 6. claim_prize_mint()
                                    ▼
        ┌───────────────────────────────────────────────────────┐
        │   Program reads: raffle.prize_collection_mint         │
        │   ↓                                                   │
        │   Program creates NEW prize NFT                       │
        │   ↓                                                   │
        │   Program verifies NFT belongs to collection          │
        │   (Uses Collection Authority PDA from step 2)         │
        │   ↓                                                   │
        │   Winner receives verified NFT ✅                     │
        └───────────────────────────┬───────────────────────────┘
                                    │
                                    │ Prize claimed ✅
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Prize NFT                   │
                    │   "RWA Prize #12345678"       │
                    │                               │
                    │   Owner: Winner (User123)     │
                    │   Collection: CoLLect1oN111...│
                    │   Verified: ✅                │
                    └───────────────────────────────┘
```

---

## 🔄 Refund Flow (If Raffle Fails)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RAFFLE FAILS (Not enough tickets)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Deadline passed, tickets_sold < required
                                    ▼
        ┌───────────────────────────────────────────────────────┐
        │   Raffle status: Refunding                            │
        │   refund_mode: 2 (user choice)                        │
        └───────────────────────────┬───────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │   Option A:           │       │   Option B:           │
        │   refund()            │       │   mint_mrft_refund()  │
        │                       │       │                       │
        │   User gets USDC back │       │   User gets MRFT NFT  │
        │   ↓                   │       │   ↓                   │
        │   Money returned      │       │   "Free ticket"       │
        │   User might leave ❌ │       │   User returns ✅     │
        └───────────────────────┘       └───────────────────────┘
```

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OFF-CHAIN (Metaplex Standard)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Collection NFT                                                             │
│   ├── Mint: CoLLect1oN111...                                                │
│   ├── Metadata: "Mogate RWA Prizes"                                         │
│   ├── Update Authority: Platform Owner                                      │
│   └── Collection Authorities:                                               │
│       ├── Auth0r1tyPDA111... (raffle program)                               │
│       └── Auth0r1tyPDA222... (direct_sell program)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ON-CHAIN (Your Raffle Program)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Raffle Account                                                             │
│   ├── organizer: OrgAn1zer111...                                            │
│   ├── mint: USDC/USDT/DAI (stable coin)                                     │
│   ├── prize_collection_mint: CoLLect1oN111... ◄─── Links to collection      │
│   ├── refund_mode: 0/1/2                                                    │
│   └── ...                                                                   │
│                                                                              │
│   Collection Authority PDA                                                   │
│   ├── Seeds: ["collection_authority", collection_mint]                      │
│   └── Can sign for collection verification                                  │
│                                                                              │
│   Prize NFT (minted on claim)                                               │
│   ├── Mint: Pr1zeM1nt111...                                                 │
│   ├── Owner: Winner                                                         │
│   ├── Collection: CoLLect1oN111... ◄─── Verified by PDA                    │
│   └── Verified: ✅                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Concepts

### 1. Collection NFT ≠ Prize NFT

```
Collection NFT (Parent)
├── Created: Off-chain, one-time
├── Type: Standard Metaplex
├── Purpose: Acts as "parent" for all prizes
└── Cost: ~$0.01 (one-time)

Prize NFT (Child)
├── Created: On-chain, when winner claims
├── Type: Standard or Compressed (your choice)
├── Purpose: Actual prize given to winner
└── Cost: ~$0.01 standard, ~$0.0001 compressed
```

### 2. Collection Authority PDA

```
PDA Derivation:
  Seeds: ["collection_authority", collection_mint]
  Program: rwa_raffle (5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M)

Permissions:
  ✅ Can verify NFTs belong to collection
  ✅ Can unverify NFTs from collection
  ❌ Cannot mint NFTs
  ❌ Cannot burn NFTs
  ❌ Cannot update collection metadata
  ❌ Cannot transfer collection NFT

Why PDA?
  - Program can sign on behalf of PDA
  - PDA can verify prize NFTs automatically
  - No need for external signatures
```

### 3. Refund Modes

```
Mode 0: USDC Refund Only
├── Simple, traditional
├── User gets money back
└── Risk: User might not return

Mode 1: MRFT Mint Only
├── Gamification, engagement
├── User gets "free ticket"
└── Benefit: User likely to return

Mode 2: Both (User Choice)
├── Most flexible
├── User decides preference
└── Recommended for production
```

---

## 📝 Code Examples

### Platform Owner: Create Collection

```bash
# Run once
bun run scripts/delegate-collection-authority.ts

# Output:
# Collection Mint: CoLLect1oN1111111111111111111111111111111
# Collection Authority PDA: Auth0r1tyPDA111111111111111111111111111
```

### Organizer: Create Raffle

```typescript
const collectionMint = new PublicKey('CoLLect1oN1111111111111111111111111111111');
const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

await program.methods
  .initializeRaffleWithPermit(
    100,              // required_tickets
    1699999999,       // deadline_unix_ts
    permitNonce,
    permitExpiry,
    true,             // auto_draw
    2,                // ticket_mode (accept without burn)
    collectionMint,   // ✅ Prize collection mint
    2,                // ✅ refund_mode (both USDC and MRFT)
  )
  .accounts({
    organizer: organizerKeypair.publicKey,
    raffle: rafflePDA,
    mint: usdcMint,   // ✅ Stable coin (organizer chooses)
    escrowAta: escrowATA,
    slots: slotsPDA,
    instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    systemProgram: SystemProgram.programId,
  })
  .signers([organizerKeypair])
  .rpc();
```

### Winner: Claim Prize

```typescript
// Derive collection authority PDA
const [collectionAuthority] = PublicKey.findProgramAddressSync(
  [
    Buffer.from('collection_authority'),
    raffle.prizeCollectionMint.toBuffer(), // ✅ From raffle config
  ],
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
    collectionAuthority: collectionAuthority,   // ✅ PDA can sign
    mintAuthority: rafflePDA,
    ticket: ticketPDA,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([winnerKeypair, newMintKeypair])
  .rpc();
```

---

## ✅ Checklist

- [ ] Run `delegate-collection-authority.ts` to create collection
- [ ] Save collection mint address
- [ ] Update backend to pass `prize_collection_mint` when creating raffles
- [ ] Update backend to pass `refund_mode` when creating raffles
- [ ] Test `claim_prize_mint()` on devnet
- [ ] Verify prize NFT shows as verified in wallet
- [ ] Test refund flow (both USDC and MRFT)
- [ ] Deploy to mainnet

---

## 🎯 Summary

1. **Collection NFT** = Off-chain, standard Metaplex, created once by platform owner
2. **Prize NFT** = On-chain, minted by program when winner claims
3. **Collection Authority PDA** = Allows program to verify prize NFTs
4. **Organizer provides** = Collection mint + stable coin mint + refund mode
5. **Winner claims** = Program reads config, mints + verifies NFT
6. **Refund modes** = USDC (0), MRFT (1), or both (2)
7. **Stable coin** = Organizer chooses (USDC/USDT/DAI/etc.)

**No hardcoding needed!** Everything is dynamic and configurable per raffle.
