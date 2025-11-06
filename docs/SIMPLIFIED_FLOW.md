# RWA Raffle - Simplified Flow (1-Transaction Model)

## Overview

**Goal**: Users pick slots and pay with $MOGA in ONE transaction. Escrow holds USDC for business stability.

---

## Core Concepts

### Raffle Configuration
```rust
pub struct Raffle {
    pub organizer: Pubkey,
    pub prize_nft: Option<Pubkey>,
    pub required_slots: u32,        // e.g., 500
    pub price_per_slot_usd: u64,    // e.g., 1_000_000 ($1 with 6 decimals)
    pub deadline_unix_ts: i64,
    pub slots_sold: u32,
    pub slot_bitmap: Vec<u8>,       // Bitmap: 500 slots = 63 bytes
    pub slot_owners: Vec<Pubkey>,   // Vec of 500 pubkeys
    pub winner_slot: Option<u32>,
    pub escrow_usdc: Pubkey,        // ATA holding USDC
    pub state: RaffleState,         // Selling | Drawing | Completed | Refunding
}
```

Note: Quotes are provided by the SDK/back-end using Pyth for pricing and routing APIs for swaps. The on-chain instruction enforces slippage and slot availability at execution.

### Pricing
- **Business sets**: `required_slots = 500`, `price_per_slot_usd = $1`
- **Total value**: 500 slots × $1 = **$500 USDC** in escrow when full
- **User pays**: $MOGA (converted to USDC via Pyth + Jupiter)

---

## Flow Diagram

### 1. Organizer Creates Raffle

```
┌─────────────────────────────────────────────────────────────┐
│ Organizer                                                    │
│                                                              │
│ initialize_raffle(                                           │
│   required_slots: 500,                                       │
│   price_per_slot_usd: $1,                                    │
│   deadline: 7 days from now,                                 │
│   prize_nft: <NFT mint address>                              │
│ )                                                            │
│                                                              │
│ Creates:                                                     │
│ • Raffle PDA account                                         │
│ • Escrow USDC ATA (owned by Raffle PDA)                      │
│ • Slot bitmap (500 bits = 63 bytes)                          │
│ • Slot owners Vec (500 pubkeys)                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 2. User Joins Raffle (1 Transaction)

#### Frontend Flow
```
User sees:
┌──────────────────────────────────────────────┐
│ Raffle: Luxury Watch                         │
│ Slots: 247/500 filled                        │
│ Price: $1 per slot                           │
│                                              │
│ Available slots: [1,2,3,5,7,8,9,...]         │
│                                              │
│ Pick your slots: [1] [3] [24] ✓              │
│                                              │
│ Quote: 3 slots = $3                          │
│ MOGA price: $2.50                            │
│ You need: 1.2 MOGA                           │
│                                              │
│ [Join Raffle] ← ONE CLICK                    │
└──────────────────────────────────────────────┘
```

#### On-Chain Instruction: `join_raffle`

```rust
pub fn join_raffle(
    ctx: Context<JoinRaffle>,
    slots: Vec<u32>,              // [1, 3, 24]
    max_moga_amount: u64,         // Slippage protection
) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    
    // 1. Validate slots
    require!(raffle.state == RaffleState::Selling, RaffleError::NotSelling);
    require!(Clock::get()?.unix_timestamp <= raffle.deadline_unix_ts, RaffleError::DeadlinePassed);
    
    for &slot in &slots {
        require!(slot >= 1 && slot <= raffle.required_slots, RaffleError::InvalidSlot);
        require!(!is_slot_occupied(raffle, slot), RaffleError::SlotOccupied);
    }
    
    // 2. Calculate USD amount needed
    let num_slots = slots.len() as u64;
    let total_usd_needed = num_slots * raffle.price_per_slot_usd; // e.g., 3 * $1 = $3
    
    // 3. Get MOGA price from Pyth
    let moga_price_usd = get_moga_price(&ctx.accounts.pyth_price_account)?; // e.g., $2.50
    
    // 4. Calculate MOGA amount needed
    let moga_amount = (total_usd_needed * PRICE_PRECISION) / moga_price_usd; // $3 / $2.50 = 1.2 MOGA
    require!(moga_amount <= max_moga_amount, RaffleError::SlippageExceeded);
    
    // 5. Swap MOGA → USDC via Jupiter CPI
    jupiter_swap(
        &ctx.accounts.jupiter_program,
        &ctx.accounts.user_moga_ata,
        &ctx.accounts.escrow_usdc_ata,
        moga_amount,
        total_usd_needed, // Minimum USDC out
    )?;
    
    // 6. Reserve slots
    for &slot in &slots {
        set_slot_occupied(raffle, slot);
        raffle.slot_owners[slot as usize - 1] = ctx.accounts.user.key();
    }
    
    raffle.slots_sold += num_slots as u32;
    
    // 7. Check if full
    if raffle.slots_sold == raffle.required_slots {
        raffle.state = RaffleState::Drawing;
        emit!(ThresholdReached { raffle: raffle.key() });
    }
    
    emit!(SlotsReserved {
        user: ctx.accounts.user.key(),
        slots: slots.clone(),
        moga_paid: moga_amount,
        usdc_value: total_usd_needed,
    });
    
    Ok(())
}
```

#### Transaction Breakdown
```
Single Transaction:
├─ Instruction 1: join_raffle
│  ├─ CPI: Jupiter.swap(MOGA → USDC)
│  ├─ Update: slot_bitmap
│  ├─ Update: slot_owners
│  └─ Update: slots_sold counter
└─ Result: User owns slots [1, 3, 24]
```

---

### 3. Raffle Completes (Full Slots)

```
Slots sold: 500/500 ✓
State: Selling → Drawing

Offchain worker triggers:
┌─────────────────────────────────────────────┐
│ request_draw_arcium()                        │
│                                             │
│ Arcium MPC:                                 │
│ • Generates random number: 1-500            │
│ • Returns winner_slot = 247                 │
│                                             │
│ draw_callback(winner_slot: 247)             │
│ • raffle.winner_slot = 247                  │
│ • raffle.state = Completed                  │
│ • winner = raffle.slot_owners[246]          │
└─────────────────────────────────────────────┘

Winner notified:
• Email (from offchain DB)
• On-chain event
• Frontend notification
```

---

### 4. Winner Claims Prize

```
Winner calls:
┌─────────────────────────────────────────────┐
│ claim_prize()                                │
│                                             │
│ Validates:                                  │
│ • raffle.state == Completed                 │
│ • user == raffle.slot_owners[winner_slot-1] │
│                                             │
│ Transfers:                                  │
│ • Prize NFT → Winner's wallet               │
│                                             │
│ Business withdraws:                         │
│ • $500 USDC from escrow → Business wallet   │
└─────────────────────────────────────────────┘
```

---

### 5. Refund Path (Deadline Passed, Not Full)

```
Deadline passed, slots sold: 247/500
State: Selling → Refunding

User calls:
┌─────────────────────────────────────────────┐
│ claim_refund()                               │
│                                             │
│ For user who reserved [1, 3, 24]:           │
│                                             │
│ 1. Calculate refund:                        │
│    • 3 slots × $1 = $3 USDC value           │
│                                             │
│ 2. Mint Refund NFT Tickets:                 │
│    • One compressed NFT per slot reserved   │
│    • E.g., 3 slots → mint 3 NFTs            │
│    • Mint to user's wallet (Bubblegum)      │
│                                             │
│ 3. Clear user's slots:                      │
│    • Unset bitmap bits [1, 3, 24]           │
│    • Clear slot_owners entries              │
│                                             │
│ 4. Ticket policy:                           │
│    • NFTs are tradeable by users            │
│    • Users cannot burn; only program/back-end recycles
│    • May be used to enter future raffles (join_with_ticket)
└─────────────────────────────────────────────┘
```

#### Refund NFT Metadata
```json
{
  "name": "MOGA Raffle Refund Ticket",
  "symbol": "MRFT",
  "description": "Refund credit for Raffle #123 (Luxury Watch)",
  "image": "https://moga.io/refund-ticket.png",
  "attributes": [
    { "trait_type": "Raffle ID", "value": "123" },
    { "trait_type": "USDC Value", "value": "3.00" },
    { "trait_type": "Original Slots", "value": "[1, 3, 24]" },
    { "trait_type": "Refund Date", "value": "2025-11-13" }
  ],
  "properties": {
    "category": "image",
    "creators": [
      { "address": "MOGA_AUTHORITY", "share": 100 }
    ]
  }
}
```

---

## State Machine

```
┌─────────────┐
│   SELLING   │ ← Initial state
└──────┬──────┘
       │
       ├─ [slots_sold == required_slots] ──────┐
       │                                        │
       ├─ [deadline passed & not full] ────┐   │
       │                                    │   │
       ▼                                    ▼   ▼
┌─────────────┐                      ┌──────────────┐
│  REFUNDING  │                      │   DRAWING    │
└──────┬──────┘                      └──────┬───────┘
       │                                    │
       │ [all refunds claimed]              │ [Arcium callback]
       │                                    │
       ▼                                    ▼
┌─────────────┐                      ┌──────────────┐
│   CLOSED    │                      │  COMPLETED   │
└─────────────┘                      └──────┬───────┘
                                            │
                                            │ [winner claims]
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │    CLOSED    │
                                     └──────────────┘
```

---

## Key Differences from Original Design

| Aspect | Original | New (Simplified) |
|--------|----------|------------------|
| **NFT Tickets** | Minted on join, burned on pick | Only minted on refund |
| **Transaction Count** | 2-3 (deposit → mint → pick) | **1** (join with slots) |
| **User Flow** | Deposit → Get tickets → Pick numbers → Burn | **Pick slots → Pay → Done** |
| **Refund** | Return MOGA | Mint tradeable NFT ticket |
| **Escrow** | Holds MOGA (volatile) | **Holds USDC (stable)** |
| **Complexity** | High (mint/burn cycle) | **Low (direct slot reservation)** |

---

## Technical Components

### 1. Pyth Integration (Price Oracle)

```rust
use pyth_sdk_solana::load_price_feed_from_account_info;

pub fn get_moga_price(pyth_account: &AccountInfo) -> Result<u64> {
    let price_feed = load_price_feed_from_account_info(pyth_account)?;
    let price = price_feed.get_current_price()
        .ok_or(RaffleError::InvalidPrice)?;
    
    // Convert to 6 decimals (USDC precision)
    let price_usd = (price.price as u64 * 1_000_000) / (10_u64.pow(price.expo.abs() as u32));
    Ok(price_usd)
}
```

**Devnet Mock:**
```rust
#[cfg(feature = "devnet")]
pub fn get_moga_price(_pyth_account: &AccountInfo) -> Result<u64> {
    Ok(2_500_000) // $2.50 hardcoded for testing
}
```

---

### 2. Jupiter Integration (Swap)

```rust
use jupiter::cpi::{shared_accounts_route, SharedAccountsRoute};

pub fn jupiter_swap<'info>(
    jupiter_program: &AccountInfo<'info>,
    source_ata: &Account<'info, TokenAccount>,
    dest_ata: &Account<'info, TokenAccount>,
    amount_in: u64,
    min_amount_out: u64,
) -> Result<()> {
    let cpi_accounts = SharedAccountsRoute {
        token_program: token_program.to_account_info(),
        user_source_token_account: source_ata.to_account_info(),
        user_destination_token_account: dest_ata.to_account_info(),
        // ... other Jupiter accounts
    };
    
    shared_accounts_route(
        CpiContext::new(jupiter_program.clone(), cpi_accounts),
        amount_in,
        min_amount_out,
    )?;
    
    Ok(())
}
```

---

### 3. Slot Bitmap Operations

```rust
pub fn is_slot_occupied(raffle: &Raffle, slot: u32) -> bool {
    let byte_index = ((slot - 1) / 8) as usize;
    let bit_index = (slot - 1) % 8;
    (raffle.slot_bitmap[byte_index] & (1 << bit_index)) != 0
}

pub fn set_slot_occupied(raffle: &mut Raffle, slot: u32) {
    let byte_index = ((slot - 1) / 8) as usize;
    let bit_index = (slot - 1) % 8;
    raffle.slot_bitmap[byte_index] |= 1 << bit_index;
}
```

---

### 4. Refund NFT Minting (Compressed)

```rust
use mpl_bubblegum::cpi::{mint_to_collection_v1, MintToCollectionV1};

pub fn mint_refund_nft<'info>(
    ctx: Context<'_, '_, '_, 'info, ClaimRefund<'info>>,
    usdc_value: u64,
    slots: Vec<u32>,
) -> Result<()> {
    let metadata = RefundNFTMetadata {
        raffle_id: ctx.accounts.raffle.key(),
        usdc_value,
        original_slots: slots,
        refund_date: Clock::get()?.unix_timestamp,
    };
    
    // Mint compressed NFT via Bubblegum
    mint_to_collection_v1(
        CpiContext::new(
            ctx.accounts.bubblegum_program.to_account_info(),
            MintToCollectionV1 {
                tree_authority: ctx.accounts.tree_authority.to_account_info(),
                leaf_owner: ctx.accounts.user.to_account_info(),
                // ... other accounts
            }
        ),
        metadata.to_metadata_args(),
    )?;
    
    Ok(())
}
```

---

## Summary

### User Experience
1. **Join**: Pick slots [1, 3, 24] → Pay 1.2 MOGA → **Done in 1 TX**
2. **Wait**: Raffle fills or deadline passes
3. **Win**: Claim prize NFT
4. **Refund**: Get tradeable NFT ticket worth $3 USDC

### Business Benefits
- ✅ **Stable revenue**: Always get $500 USDC (not volatile MOGA)
- ✅ **Simple UX**: Users pick slots directly
- ✅ **Tradeable refunds**: NFT tickets create secondary market
- ✅ **Royalties**: 2.5% on NFT ticket trades

### Technical Advantages
- ✅ **1 transaction**: No mint/burn complexity
- ✅ **On-chain pricing**: Pyth oracle (trustless)
- ✅ **Best swap rates**: Jupiter aggregator
- ✅ **Scalable**: Compressed NFTs for refunds
- ✅ **Verifiable randomness**: Arcium MPC

---

## Next Steps

1. **Implement `join_raffle` instruction** with Pyth + Jupiter integration
2. **Add slot bitmap** to Raffle account (63 bytes for 500 slots)
3. **Integrate Metaplex Bubblegum** for refund NFT minting
4. **Create frontend** with slot picker UI and MOGA price quotes
5. **Deploy Pyth mock** for devnet testing
