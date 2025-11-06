# PDA Operations Guide

## Overview

This guide explains how PDAs (Program Derived Addresses) are used throughout the RWA raffle program for **derivation**, **retrieval**, and **signing/delegation**.

---

## PDA Account Types

### 1. Raffle PDA
**Purpose**: Main raffle state account and escrow authority

**Seeds**:
```rust
["raffle", mint_pubkey, organizer_pubkey]
```

**Derivation**:
```rust
#[account(
    init,
    payer = organizer,
    space = 8 + Raffle::LEN,
    seeds = [RAFFLE_SEED, mint.key().as_ref(), organizer.key().as_ref()],
    bump,
)]
pub raffle: Account<'info, Raffle>
```

**Used in**: All instructions (central state)

---

### 2. Ticket PDA
**Purpose**: Individual ticket ownership record

**Seeds**:
```rust
["ticket", raffle_pubkey, owner_pubkey, start_index_bytes]
```

**Derivation**:
```rust
#[account(
    init,
    payer = payer,
    space = 8 + Ticket::LEN,
    seeds = [TICKET_SEED, raffle.key().as_ref(), payer.key().as_ref(), &start_index.to_le_bytes()],
    bump,
)]
pub ticket: Account<'info, Ticket>
```

**Used in**: deposit, claim_refund, claim_win, claim_prize

---

### 3. Light CPI Signer PDA
**Purpose**: Authority for Light Protocol compressed account operations

**Derivation**:
```rust
pub const LIGHT_CPI_SIGNER: CpiSigner = 
    derive_light_cpi_signer!("RwaRafLe1111111111111111111111111111111111111");
```

**Used in**: deposit_compressed

---

## PDA Operations by Instruction

### Initialize Raffle
**Operation**: Derive + Create

```rust
// Raffle PDA is derived and created
#[account(
    init,
    seeds = [RAFFLE_SEED, mint.key().as_ref(), organizer.key().as_ref()],
    bump,
)]
pub raffle: Account<'info, Raffle>
```

**No retrieval needed** - first time creation

---

### Deposit (Regular)
**Operations**: 
- Derive + Create (Ticket PDA)
- Retrieve (Raffle PDA)

```rust
// Create new ticket
#[account(
    init,
    seeds = [TICKET_SEED, raffle.key().as_ref(), payer.key().as_ref(), &start_index.to_le_bytes()],
    bump,
)]
pub ticket: Account<'info, Ticket>

// Retrieve existing raffle
#[account(mut, has_one = mint)]
pub raffle: Account<'info, Raffle>
```

---

### Deposit Compressed
**Operations**:
- Derive (Light address + CPI signer)
- Retrieve (Raffle PDA)

```rust
// Derive compressed address
let (address, address_seed) = derive_address(
    &[b"ticket", raffle.key().as_ref(), ctx.accounts.signer.key().as_ref(), &start_index.to_le_bytes()],
    &tree_pubkey,
    &crate::ID,
);

// Use Light CPI Signer for authority
let light_cpi_accounts = CpiAccounts::new(
    ctx.accounts.signer.as_ref(),
    ctx.remaining_accounts,
    crate::LIGHT_CPI_SIGNER,  // ← PDA signer
);
```

---

### Claim Refund
**Operations**:
- Retrieve (Raffle PDA, Ticket PDA)
- **Sign** (Raffle PDA signs token transfer)

```rust
// Retrieve PDAs
#[account(mut, has_one = mint)]
pub raffle: Account<'info, Raffle>

#[account(mut, seeds = [TICKET_SEED, raffle.key().as_ref(), payer.key().as_ref(), &ticket.start.to_le_bytes()], bump = ticket.bump)]
pub ticket: Account<'info, Ticket>

// Raffle PDA signs transfer from escrow
let seeds: &[&[u8]] = &[
    RAFFLE_SEED,
    raffle.mint.as_ref(),
    raffle.organizer.as_ref(),
    &[raffle.bump],  // ← Stored bump
];
let signer = &[seeds];

token::transfer_checked(
    CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
    amount,
    decimals
)?;
```

**PDA Delegation**: Raffle PDA acts as authority to transfer tokens from escrow ATA back to user.

---

### Claim Win
**Operations**:
- Retrieve (Raffle PDA, Ticket PDA)
- No signing (just state update)

```rust
#[account(mut)]
pub raffle: Account<'info, Raffle>

#[account(mut, seeds = [TICKET_SEED, raffle.key().as_ref(), winner.key().as_ref(), &ticket.start.to_le_bytes()], bump = ticket.bump)]
pub ticket: Account<'info, Ticket>

// Just mark ticket as claimed
ticket.claimed_win = true;
```

---

### Claim Prize
**Operations**:
- Retrieve (Raffle PDA, Ticket PDA)
- **Sign** (Raffle PDA signs NFT transfer)

```rust
// Raffle PDA signs NFT transfer to winner
let seeds: &[&[u8]] = &[
    RAFFLE_SEED,
    raffle.mint.as_ref(),
    raffle.organizer.as_ref(),
    &[raffle.bump],
];
let signer = &[seeds];

token::transfer_checked(
    CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
    1,  // NFT amount
    0   // NFT decimals
)?;
```

**PDA Delegation**: Raffle PDA acts as authority to transfer prize NFT from escrow to winner.

---

## PDA Signing Patterns

### Pattern 1: Token Transfer Authority
**Used in**: claim_refund, claim_prize

The Raffle PDA owns the escrow ATAs and must sign to authorize token transfers.

```rust
// 1. Reconstruct PDA seeds
let seeds: &[&[u8]] = &[
    RAFFLE_SEED,
    raffle.mint.as_ref(),
    raffle.organizer.as_ref(),
    &[raffle.bump],  // Bump stored in account
];
let signer = &[seeds];

// 2. Use PDA as signing authority
let cpi_accounts = TransferChecked {
    from: ctx.accounts.escrow_ata.to_account_info(),
    to: ctx.accounts.recipient_ata.to_account_info(),
    mint: ctx.accounts.mint.to_account_info(),
    authority: ctx.accounts.raffle.to_account_info(),  // ← PDA authority
};

// 3. Invoke with signer
token::transfer_checked(
    CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
    amount,
    decimals
)?;
```

---

### Pattern 2: Light Protocol CPI Signer
**Used in**: deposit_compressed

The Light CPI Signer PDA provides authority for Light Protocol operations.

```rust
// 1. Constant CPI signer (derived at compile time)
pub const LIGHT_CPI_SIGNER: CpiSigner = 
    derive_light_cpi_signer!("RwaRafLe1111111111111111111111111111111111111");

// 2. Create CPI accounts with signer
let light_cpi_accounts = CpiAccounts::new(
    ctx.accounts.signer.as_ref(),
    ctx.remaining_accounts,
    crate::LIGHT_CPI_SIGNER,  // ← PDA signer
);

// 3. Invoke Light System Program
LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
    .with_light_account(ticket_acc)?
    .with_new_addresses(&[new_address_params])
    .invoke(light_cpi_accounts)?;
```

---

## PDA Delegation Summary

| Instruction | PDA Used | Delegation Purpose |
|-------------|----------|-------------------|
| initialize_raffle | Raffle PDA | Created as escrow owner |
| deposit | Ticket PDA | Created for ownership |
| deposit_compressed | Light CPI Signer | Authority for Light operations |
| claim_refund | Raffle PDA | Signs token transfer from escrow |
| claim_win | Ticket PDA | State update only |
| claim_prize | Raffle PDA | Signs NFT transfer from escrow |

---

## Key Concepts

### PDA as Escrow Authority
The Raffle PDA owns the escrow ATAs:
- Users transfer tokens TO the escrow (no PDA signature needed)
- Raffle PDA must sign to transfer tokens FROM the escrow (refunds, prizes)

### Bump Storage
The bump seed is stored in the account to avoid recomputation:
```rust
pub struct Raffle {
    // ... other fields
    pub bump: u8,  // ← Stored for later use
}
```

### Light CPI Signer
Special PDA for Light Protocol operations:
- Derived from program ID at compile time
- Provides authority for compressed account operations
- No bump needed (uses canonical derivation)

---

## Visual Reference

See **`docs/pda-operations.svg`** for:
- Visual diagram of all PDA types
- PDA operations per instruction
- Code examples for signing patterns
- Color-coded operation types (derive, retrieve, sign)

---

## Common Patterns

### Creating a PDA
```rust
#[account(
    init,
    payer = payer,
    space = 8 + AccountStruct::LEN,
    seeds = [SEED, key1.as_ref(), key2.as_ref()],
    bump,
)]
pub pda_account: Account<'info, AccountStruct>
```

### Retrieving a PDA
```rust
#[account(
    mut,
    seeds = [SEED, key1.as_ref(), key2.as_ref()],
    bump = pda_account.bump
)]
pub pda_account: Account<'info, AccountStruct>
```

### Signing with a PDA
```rust
let seeds: &[&[u8]] = &[SEED, key1.as_ref(), key2.as_ref(), &[bump]];
let signer = &[seeds];
CpiContext::new_with_signer(program, accounts, signer)
```

---

## Related Documentation

- **`pda-operations.svg`** - Visual diagram
- **`full-architecture-flow.svg`** - Where PDAs fit in architecture
- **`lib.rs`** - Implementation code
- **Anchor Book**: https://book.anchor-lang.com/anchor_in_depth/PDAs.html
