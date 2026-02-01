# ZK-Compressed Raffle Design (Light Protocol)

## Problem Statement

Current `multi_raffle` stores slot ownership in a `Vec<Pubkey>`:

- **1,000 slots** = ~32 KB + rent
- **1,000,000 slots** = ~32 MB (exceeds Solana account limits, massive rent cost)

With Light Protocol's zk-compression, we can support **millions of slots** with constant on-chain storage.

---

## Architecture Overview

### Current (Vec-based)

```
RaffleSlots {
    raffle: Pubkey,
    total_slots: u32,
    slot_owners: Vec<Pubkey>  // ❌ O(N) storage
}
```

### ZK-Compressed (Merkle tree-based)

```
RaffleSlots {
    raffle: Pubkey,
    total_slots: u32,
    merkle_tree: Pubkey,      // ✅ Reference to Light state tree
    slots_root: [u8; 32],     // ✅ Merkle root (32 bytes regardless of N)
}
```

---

## Key Changes

### 1. Account Structure

#### Before

```rust
#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub total_slots: u32,
    pub slot_owners: Vec<Pubkey>, // Unbounded!
}
```

#### After

```rust
#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub total_slots: u32,
    pub merkle_tree: Pubkey,       // Light state tree
    pub slots_root: [u8; 32],      // Current Merkle root
}

impl RaffleSlots {
    pub const LEN: usize = 32 + 4 + 32 + 32; // Fixed size!
}
```

### 2. Slot Representation

Each slot becomes a **compressed PDA leaf** in Light's state tree:

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct SlotLeaf {
    pub raffle: Pubkey,    // Which raffle
    pub slot_id: u32,      // Which slot (1-based)
    pub owner: Pubkey,     // Who owns it (default = unoccupied)
}
```

### 3. Instruction Flow Changes

#### A. Host Raffle (Initialize)

**Before:**

```rust
// Allocate Vec<Pubkey> with total_slots elements
slots.slot_owners = vec![Pubkey::default(); total_slots as usize];
```

**After:**

```rust
// Create/reference Light state tree
// Initialize with empty root
slots.merkle_tree = light_tree_pubkey;
slots.slots_root = EMPTY_ROOT;
// No per-slot allocation needed!
```

#### B. Join Raffle (Update Slots)

**Before:**

```rust
// Direct Vec mutation
for slot in slot_ids {
    let idx = (slot - 1) as usize;
    require!(slots.slot_owners[idx] == Pubkey::default(), SlotTaken);
    slots.slot_owners[idx] = payer;
}
```

**After:**

```rust
// CPI to Light compressed PDA program
for slot in slot_ids {
    // Client provides:
    // - Merkle proof that slot is currently empty
    // - New leaf data (slot_id, owner = payer)

    light_compressed_pda::cpi::update_compressed_pda(
        CpiContext::new_with_signer(...),
        UpdateCompressedPdaParams {
            old_leaf: SlotLeaf { raffle, slot_id: slot, owner: Pubkey::default() },
            new_leaf: SlotLeaf { raffle, slot_id: slot, owner: payer },
            merkle_proof: proof_from_client,
        }
    )?;
}

// Update root after all updates
slots.slots_root = new_root_from_light;
```

#### C. Draw Winner (Two-Phase)

**Before (single phase):**

```rust
pub fn draw_raffle(ctx: Context<DrawRaffle>) -> Result<()> {
    let winner_slot = pick_random_slot();
    let winner = slots.slot_owners[winner_slot - 1]; // Direct read
    raffle.winner = winner;
    raffle.status = Drawn;
}
```

**After (two phases):**

**Phase 1: Pick Winner Slot**

```rust
pub fn draw_raffle(ctx: Context<DrawRaffle>) -> Result<()> {
    require!(raffle.status == Filled, ...);

    // Pick winner slot deterministically
    let winner_slot = ((clock.unix_timestamp % total_slots) + 1) as u32;

    raffle.winner_slot = winner_slot;
    raffle.status = WinnerSlotPicked; // New intermediate status

    // DON'T set raffle.winner yet - we need proof!
}
```

**Phase 2: Finalize Winner (Proof-Based)**

```rust
pub fn finalize_winner(
    ctx: Context<FinalizeWinner>,
    merkle_proof: Vec<[u8; 32]>,
) -> Result<()> {
    require!(raffle.status == WinnerSlotPicked, ...);

    let winner_slot = raffle.winner_slot;

    // Client provides Merkle proof that:
    // - At slot_id = winner_slot
    // - Owner = some_pubkey

    let leaf = SlotLeaf {
        raffle: raffle.key(),
        slot_id: winner_slot,
        owner: claimed_winner,
    };

    // Verify proof against slots.slots_root
    require!(
        verify_merkle_proof(&leaf, &merkle_proof, &slots.slots_root),
        InvalidProof
    );

    raffle.winner = claimed_winner;
    raffle.status = Drawn;
}
```

---

## Implementation Steps

### Step 1: Update Dependencies (Cargo.toml)

```toml
[dependencies]
anchor-lang = "0.32.0"
anchor-spl = { version = "0.32.0", features = ["metadata"] }
mpl-token-metadata = "5.0.0"

# Light Protocol for zk-compression
light-sdk = "0.12.0"
light-compressed-pda = "0.7.0"
light-hasher = "0.7.0"
light-merkle-tree-reference = "0.7.0"
```

### Step 2: Update RaffleSlots Account

```rust
#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub total_slots: u32,
    pub merkle_tree: Pubkey,
    pub slots_root: [u8; 32],
}

impl RaffleSlots {
    pub const LEN: usize = 32 + 4 + 32 + 32; // Always 100 bytes!
}
```

### Step 3: Add SlotLeaf Type

```rust
use light_sdk::compressed_account::CompressedAccount;
use light_hasher::Poseidon;

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct SlotLeaf {
    pub raffle: Pubkey,
    pub slot_id: u32,
    pub owner: Pubkey,
}

impl SlotLeaf {
    pub fn hash(&self) -> [u8; 32] {
        let mut hasher = Poseidon::new();
        hasher.hash(&[
            self.raffle.to_bytes(),
            &self.slot_id.to_le_bytes(),
            self.owner.to_bytes(),
        ].concat())
    }
}
```

### Step 4: Update Host Instruction

```rust
pub fn unsafe_host_raffle(
    ctx: Context<UnsafeHostRaffle>,
    raffle_id: String,
    total_slots: u32,
    // ... other params
) -> Result<()> {
    // ... existing raffle setup ...

    let slots = &mut ctx.accounts.slots;
    slots.raffle = raffle.key();
    slots.total_slots = total_slots;
    slots.merkle_tree = ctx.accounts.light_merkle_tree.key();
    slots.slots_root = EMPTY_MERKLE_ROOT; // Constant for empty tree

    // No Vec allocation!
    Ok(())
}

#[derive(Accounts)]
#[instruction(raffle_id: String, total_slots: u32)]
pub struct UnsafeHostRaffle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = payer,
        space = 8 + Raffle::LEN,
        seeds = [RAFFLE_SEED, raffle_id.as_bytes()],
        bump,
    )]
    pub raffle: Account<'info, Raffle>,

    #[account(
        init,
        payer = payer,
        space = 8 + RaffleSlots::LEN, // Fixed size now!
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub slots: Account<'info, RaffleSlots>,

    /// CHECK: Light Protocol state tree
    pub light_merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Light Protocol program
    pub light_system_program: UncheckedAccount<'info>,

    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
```

### Step 5: Update Join Instruction

```rust
pub fn unsafe_join_raffle(
    ctx: Context<UnsafeJoinRaffle>,
    slot_ids: Vec<u32>,
    amount: u64,
    merkle_proofs: Vec<Vec<[u8; 32]>>, // One proof per slot
) -> Result<()> {
    require!(!slot_ids.is_empty(), RaffleError::NoSlots);
    require!(slot_ids.len() == merkle_proofs.len(), RaffleError::InvalidProof);

    let raffle = &mut ctx.accounts.raffle;
    let slots = &mut ctx.accounts.slots;
    let user = &mut ctx.accounts.user_raffle;

    // ... existing validation ...

    // For each slot, verify it's empty and update via Light
    for (i, slot_id) in slot_ids.iter().enumerate() {
        let old_leaf = SlotLeaf {
            raffle: raffle.key(),
            slot_id: *slot_id,
            owner: Pubkey::default(), // Must be empty
        };

        let new_leaf = SlotLeaf {
            raffle: raffle.key(),
            slot_id: *slot_id,
            owner: ctx.accounts.payer.key(),
        };

        // Verify old leaf exists with provided proof
        require!(
            verify_compressed_account(
                &old_leaf.hash(),
                &merkle_proofs[i],
                &slots.slots_root,
            ),
            RaffleError::SlotTaken
        );

        // Update via Light CPI
        light_compressed_pda::cpi::update_compressed_account(
            CpiContext::new_with_signer(
                ctx.accounts.light_system_program.to_account_info(),
                light_compressed_pda::cpi::accounts::UpdateCompressedAccount {
                    authority: ctx.accounts.payer.to_account_info(),
                    merkle_tree: ctx.accounts.light_merkle_tree.to_account_info(),
                    // ... other Light accounts
                },
                &[],
            ),
            old_leaf.hash(),
            new_leaf.hash(),
            merkle_proofs[i].clone(),
        )?;

        user.slots.push(*slot_id);
    }

    // Update root from Light tree
    let tree_account = &ctx.accounts.light_merkle_tree;
    slots.slots_root = get_merkle_root_from_tree(tree_account)?;

    raffle.sold_slots += slot_ids.len() as u32;

    if raffle.sold_slots == raffle.total_slots {
        raffle.status = MultiRaffleStatus::Filled as u8;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct UnsafeJoinRaffle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, Config>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut, seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,

    #[account(
        init,
        payer = payer,
        space = 8 + UserRaffle::space(),
        seeds = [USER_SEED, raffle.key().as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,

    /// CHECK: Light Protocol state tree
    #[account(mut, address = slots.merkle_tree)]
    pub light_merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Light Protocol program
    pub light_system_program: UncheckedAccount<'info>,

    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
```

### Step 6: Two-Phase Draw

```rust
// Phase 1: Pick winner slot
pub fn draw_raffle(ctx: Context<DrawRaffle>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(raffle.status == MultiRaffleStatus::Filled as u8, RaffleError::BadStatus);

    let clock = Clock::get()?;
    let winner_slot = ((clock.unix_timestamp % raffle.total_slots as i64) + 1) as u32;

    raffle.winner_slot = winner_slot;
    raffle.status = MultiRaffleStatus::WinnerSlotPicked as u8; // New status

    Ok(())
}

// Phase 2: Finalize winner with proof
pub fn finalize_winner(
    ctx: Context<FinalizeWinner>,
    claimed_winner: Pubkey,
    merkle_proof: Vec<[u8; 32]>,
) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let slots = &ctx.accounts.slots;

    require!(
        raffle.status == MultiRaffleStatus::WinnerSlotPicked as u8,
        RaffleError::BadStatus
    );

    // Verify that claimed_winner owns winner_slot
    let leaf = SlotLeaf {
        raffle: raffle.key(),
        slot_id: raffle.winner_slot,
        owner: claimed_winner,
    };

    require!(
        verify_merkle_proof(&leaf.hash(), &merkle_proof, &slots.slots_root),
        RaffleError::InvalidProof
    );

    raffle.winner = claimed_winner;
    raffle.status = MultiRaffleStatus::Drawn as u8;

    Ok(())
}

#[derive(Accounts)]
pub struct FinalizeWinner<'info> {
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}
```

### Step 7: Add New Status

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MultiRaffleStatus {
    Open = 0,
    Filled = 1,
    WinnerSlotPicked = 2, // NEW: between Filled and Drawn
    Drawn = 3,
    Cancelled = 4,
}
```

---

## Client-Side Changes

### Before (Vec-based)

```typescript
// Just send slot_ids
await program.methods
  .unsafeJoinRaffle([1, 5, 10], amount)
  .accounts({ ... })
  .rpc();
```

### After (ZK-compressed)

```typescript
import { Rpc, bn } from "@lightprotocol/stateless.js";

// 1. Fetch current Merkle tree state
const rpc = createRpc();
const tree = await rpc.getCompressedAccountsByOwner(rafflePubkey);

// 2. For each slot, generate Merkle proof
const proofs = [];
for (const slotId of [1, 5, 10]) {
  const leaf = hashSlotLeaf(rafflePubkey, slotId, PublicKey.default);
  const proof = await rpc.getValidityProof([leaf]);
  proofs.push(proof.merkleProofs[0]);
}

// 3. Send with proofs
await program.methods
  .unsafeJoinRaffle([1, 5, 10], amount, proofs)
  .accounts({
    ...accounts,
    lightMerkleTree: tree.address,
    lightSystemProgram: LIGHT_PROGRAM_ID,
  })
  .rpc();
```

---

## Benefits

### Storage

- **Before**: 1M slots = 32 MB on-chain
- **After**: 1M slots = 100 bytes on-chain (fixed `RaffleSlots` size)

### Rent

- **Before**: ~220 SOL rent for 32 MB
- **After**: ~0.001 SOL rent for 100 bytes

### Performance

- **Before**: O(N) deserialization on every instruction
- **After**: O(1) on-chain, O(log N) proof verification

### Scalability

- **Before**: Hard limit ~10K slots (account size limits)
- **After**: Millions of slots possible

---

## Migration Path

1. **Deploy `multi_raffle-light` as new program**
2. **Keep existing `multi_raffle` for small raffles (<1000 slots)**
3. **Use `multi_raffle-light` for large raffles (>1000 slots)**
4. **Frontend detects total_slots and routes to appropriate program**

---

## Testing Checklist

- [ ] Host raffle with 1M slots (should succeed with minimal rent)
- [ ] Join with valid proofs (should update Merkle root)
- [ ] Join with invalid proof (should fail with SlotTaken)
- [ ] Draw winner and finalize with correct proof
- [ ] Finalize with wrong proof (should fail)
- [ ] Claim prize after finalization
- [ ] Refund logic still works

---

## Next Steps

1. ✅ Add Light Protocol dependencies
2. ⏳ Implement new `RaffleSlots` structure
3. ⏳ Rewrite `unsafe_host_raffle` for Light trees
4. ⏳ Rewrite `unsafe_join_raffle` with proof verification
5. ⏳ Split `draw_raffle` into two phases
6. ⏳ Add `finalize_winner` instruction
7. ⏳ Update client SDK with Light RPC calls
8. ⏳ Write integration tests
9. ⏳ Deploy to devnet
10. ⏳ Benchmark 1M slot raffle

---

## Resources

- [Light Protocol Docs](https://www.zkcompression.com/)
- [Compressed PDAs Guide](https://www.zkcompression.com/compressed-pdas/overview)
- [Light SDK Reference](https://docs.rs/light-sdk/latest/light_sdk/)
- [Example: Token Distribution](https://github.com/Lightprotocol/example-token-distribution)
