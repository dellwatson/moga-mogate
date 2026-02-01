# Multi-Raffle with ZK-Compression Implementation Guide

## 🎯 Goal

Transform `multi_raffle` to support **millions of slots** using Light Protocol's zk-compression, eliminating the current ~1000 slot limit.

## 📊 Current vs Target

| Metric             | Current (Vec-based) | Target (ZK-compressed) |
| ------------------ | ------------------- | ---------------------- |
| Max slots          | ~1,000              | 1,000,000+             |
| Storage (1M slots) | 32 MB               | 100 bytes              |
| Rent (1M slots)    | ~220 SOL            | ~0.001 SOL             |
| Account size       | O(N)                | O(1)                   |
| Join complexity    | O(1) write          | O(log N) proof         |

## 🏗️ Architecture

### Storage Model

**Before:**

```
RaffleSlots {
    slot_owners: Vec<Pubkey>  // [owner1, owner2, ..., ownerN]
}
Size = 32N bytes
```

**After:**

```
RaffleSlots {
    merkle_tree: Pubkey,      // Reference to Light state tree
    slots_root: [u8; 32],     // Merkle root
}
Size = 64 bytes (constant!)
```

### Slot Representation

Each slot becomes a **leaf** in Light's compressed Merkle tree:

```rust
SlotLeaf {
    raffle: Pubkey,    // Which raffle
    slot_id: u32,      // Slot number (1-based)
    owner: Pubkey,     // Owner (default = empty)
}
```

## 📝 Implementation Steps

### Step 1: Update Dependencies ✅

Already done in `Cargo.toml`:

```toml
light-sdk = "0.12.0"
light-compressed-pda = "0.7.0"
light-hasher = "0.7.0"
light-merkle-tree-reference = "0.7.0"
```

### Step 2: Modify `RaffleSlots` Structure

**File:** `src/lib.rs`

**Current:**

```rust
#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub total_slots: u32,
    pub slot_owners: Vec<Pubkey>, // ❌ Remove this
}

impl RaffleSlots {
    pub fn space(total_slots: u32) -> usize {
        32 + 4 + 4 + (total_slots as usize) * 32
    }
}
```

**New:**

```rust
#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub total_slots: u32,
    pub merkle_tree: Pubkey,      // ✅ Add: Light state tree
    pub slots_root: [u8; 32],     // ✅ Add: Current Merkle root
}

impl RaffleSlots {
    pub const LEN: usize = 32 + 4 + 32 + 32; // Fixed 100 bytes!
}
```

### Step 3: Add New Raffle Status

**File:** `src/lib.rs`

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MultiRaffleStatus {
    Open = 0,
    Filled = 1,
    WinnerSlotPicked = 2,  // ✅ Add: intermediate status
    Drawn = 3,             // Changed from 2 to 3
    Cancelled = 4,         // Changed from 3 to 4
}
```

### Step 4: Update `unsafe_host_raffle`

**File:** `src/lib.rs`

**Current:**

```rust
pub fn unsafe_host_raffle(
    ctx: Context<UnsafeHostRaffle>,
    // ... params
) -> Result<()> {
    // ... raffle setup ...

    let slots = &mut ctx.accounts.slots;
    slots.raffle = raffle.key();
    slots.total_slots = total_slots;
    slots.slot_owners = vec![Pubkey::default(); total_slots as usize]; // ❌

    Ok(())
}
```

**New:**

```rust
use crate::zk_types::EMPTY_MERKLE_ROOT;

pub fn unsafe_host_raffle(
    ctx: Context<UnsafeHostRaffle>,
    // ... params
) -> Result<()> {
    // ... raffle setup ...

    let slots = &mut ctx.accounts.slots;
    slots.raffle = raffle.key();
    slots.total_slots = total_slots;
    slots.merkle_tree = ctx.accounts.light_merkle_tree.key(); // ✅
    slots.slots_root = EMPTY_MERKLE_ROOT; // ✅

    // No Vec allocation - constant size!
    Ok(())
}
```

**Update Context:**

```rust
#[derive(Accounts)]
#[instruction(raffle_id: String, total_slots: u32)]
pub struct UnsafeHostRaffle<'info> {
    // ... existing accounts ...

    #[account(
        init,
        payer = payer,
        space = 8 + RaffleSlots::LEN, // ✅ Fixed size now!
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub slots: Account<'info, RaffleSlots>,

    /// CHECK: Light Protocol state tree
    pub light_merkle_tree: UncheckedAccount<'info>, // ✅ Add

    /// CHECK: Light Protocol program
    pub light_system_program: UncheckedAccount<'info>, // ✅ Add

    // ... rest of accounts ...
}
```

### Step 5: Rewrite `unsafe_join_raffle`

This is the most complex change. The join logic must:

1. Accept Merkle proofs from client
2. Verify each slot is empty via proof
3. Update compressed state via Light CPI
4. Update Merkle root

**File:** `src/lib.rs`

```rust
use crate::zk_types::{SlotLeaf, MerkleProof};

pub fn unsafe_join_raffle(
    ctx: Context<UnsafeJoinRaffle>,
    slot_ids: Vec<u32>,
    amount: u64,
    merkle_proofs: Vec<Vec<[u8; 32]>>, // ✅ Add: one proof per slot
) -> Result<()> {
    require!(!slot_ids.is_empty(), RaffleError::NoSlots);
    require!(
        slot_ids.len() == merkle_proofs.len(),
        RaffleError::InvalidProof
    );

    let raffle = &mut ctx.accounts.raffle;
    let slots = &mut ctx.accounts.slots;
    let user = &mut ctx.accounts.user_raffle;

    // ... existing validation (status, expiry, capacity) ...

    // Handle payment
    handle_native_payment(
        &ctx.accounts.payer,
        &ctx.accounts.treasury,
        &ctx.accounts.system_program,
        user,
        amount,
    )?;

    user.raffle = raffle.key();
    user.user = ctx.accounts.payer.key();

    // ✅ NEW: Verify and update each slot via Light
    for (i, slot_id) in slot_ids.iter().enumerate() {
        require!(
            *slot_id >= 1 && *slot_id <= raffle.total_slots,
            RaffleError::SlotOutOfRange
        );

        // Check for duplicates in this request
        for j in 0..i {
            require!(slot_ids[j] != *slot_id, RaffleError::DuplicateSlot);
        }

        // Create leaf representations
        let old_leaf = SlotLeaf::empty(raffle.key(), *slot_id);
        let new_leaf = SlotLeaf {
            raffle: raffle.key(),
            slot_id: *slot_id,
            owner: ctx.accounts.payer.key(),
        };

        // Verify slot is currently empty
        let proof = MerkleProof {
            leaf: old_leaf.hash(),
            proof: merkle_proofs[i].clone(),
            leaf_index: (*slot_id - 1), // 0-indexed in tree
        };

        require!(
            proof.verify(&slots.slots_root),
            RaffleError::SlotTaken
        );

        // CPI to Light to update compressed state
        light_compressed_pda::cpi::update_compressed_account(
            CpiContext::new_with_signer(
                ctx.accounts.light_system_program.to_account_info(),
                light_compressed_pda::cpi::accounts::UpdateCompressedAccount {
                    authority: ctx.accounts.payer.to_account_info(),
                    merkle_tree: ctx.accounts.light_merkle_tree.to_account_info(),
                    // Add other required Light accounts here
                },
                &[],
            ),
            old_leaf.hash(),
            new_leaf.hash(),
            merkle_proofs[i].clone(),
        )?;

        user.slots.push(*slot_id);
    }

    // ✅ Update Merkle root from Light tree
    // (In practice, Light returns new root from CPI)
    // For now, we'll read it from the tree account
    slots.slots_root = get_current_root(&ctx.accounts.light_merkle_tree)?;

    raffle.sold_slots += slot_ids.len() as u32;

    if raffle.sold_slots == raffle.total_slots {
        raffle.status = MultiRaffleStatus::Filled as u8;
        // Note: auto_draw now requires two-phase (see Step 6)
    }

    Ok(())
}

// Helper to read current root from Light tree
fn get_current_root(tree_account: &UncheckedAccount) -> Result<[u8; 32]> {
    // Implementation depends on Light's tree account structure
    // See Light SDK docs for exact deserialization
    // Placeholder:
    Ok([0u8; 32])
}
```

**Update Context:**

```rust
#[derive(Accounts)]
pub struct UnsafeJoinRaffle<'info> {
    // ... existing accounts ...

    #[account(mut, seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,

    /// CHECK: Light Protocol state tree
    #[account(mut, address = slots.merkle_tree)] // ✅ Must match raffle's tree
    pub light_merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Light Protocol program
    pub light_system_program: UncheckedAccount<'info>,

    // ... rest of accounts ...
}
```

### Step 6: Split Draw into Two Phases

**Phase 1: Pick Winner Slot (Deterministic)**

```rust
pub fn draw_raffle(ctx: Context<DrawRaffle>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(
        raffle.status == MultiRaffleStatus::Filled as u8,
        RaffleError::BadStatus
    );

    // Pick winner slot deterministically
    let clock = Clock::get()?;
    let total = raffle.total_slots as i64;
    let winner_slot = ((clock.unix_timestamp % total) + 1) as u32;

    raffle.winner_slot = winner_slot;
    raffle.status = MultiRaffleStatus::WinnerSlotPicked as u8; // ✅ New status

    // DON'T set raffle.winner yet - need proof!
    Ok(())
}
```

**Phase 2: Finalize Winner (Proof-Based)**

```rust
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

    // Verify that claimed_winner owns the winner_slot
    let leaf = SlotLeaf {
        raffle: raffle.key(),
        slot_id: raffle.winner_slot,
        owner: claimed_winner,
    };

    let proof = MerkleProof {
        leaf: leaf.hash(),
        proof: merkle_proof,
        leaf_index: raffle.winner_slot - 1,
    };

    require!(
        proof.verify(&slots.slots_root),
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

### Step 7: Add New Error

```rust
#[error_code]
pub enum RaffleError {
    // ... existing errors ...

    #[msg("InvalidProof")]
    InvalidProof, // ✅ Add
}
```

### Step 8: Update Module Structure

**File:** `src/lib.rs` (top)

```rust
use anchor_lang::prelude::*;
// ... existing imports ...

mod zk_types; // ✅ Add
use zk_types::{SlotLeaf, MerkleProof, EMPTY_MERKLE_ROOT};

declare_id!("2qaxQY3shNquV8STxFPoJW6bL9FUAEzUqinZSP163znG");
```

### Step 9: Remove Old Vec-Based Logic

**Delete or comment out:**

- `_join_raffle_internal` function (replaced by proof-based logic)
- `_end_raffle_internal` function (replaced by two-phase draw)
- `check_slots_availability` (requires different approach with compression)
- `get_taken_slots_in_range` (requires Light RPC queries)
- `get_available_slots_in_range` (requires Light RPC queries)

**Note:** View helpers now need to query Light's indexer off-chain, not on-chain Vec.

## 🧪 Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raffle_slots_size() {
        // Verify fixed size regardless of total_slots
        assert_eq!(RaffleSlots::LEN, 100);
    }

    #[test]
    fn test_slot_leaf_hash() {
        let raffle = Pubkey::new_unique();
        let leaf1 = SlotLeaf::empty(raffle, 1);
        let leaf2 = SlotLeaf::empty(raffle, 1);

        // Same slot should hash to same value
        assert_eq!(leaf1.hash(), leaf2.hash());
    }
}
```

### Integration Tests

```typescript
// tests/multi_raffle_light.ts

import { Rpc, createRpc } from "@lightprotocol/stateless.js";

describe("multi_raffle_light", () => {
  it("Host raffle with 1M slots", async () => {
    const tx = await program.methods
      .unsafeHostRaffle(
        "test-1m-slots",
        1_000_000, // ✅ 1 million slots!
        10,
        "https://...",
        collection,
        false,
        false,
        0,
        0,
        false,
        false,
        0,
      )
      .accounts({
        // ... accounts ...
        lightMerkleTree: merkleTreePubkey,
        lightSystemProgram: LIGHT_PROGRAM_ID,
      })
      .rpc();

    // Should succeed with minimal rent
    const slotsAccount = await program.account.raffleSlots.fetch(slotsPda);
    assert.equal(slotsAccount.totalSlots, 1_000_000);
  });

  it("Join with valid proof", async () => {
    // 1. Get current tree state
    const rpc = createRpc();
    const tree = await rpc.getCompressedAccountsByOwner(rafflePubkey);

    // 2. Generate Merkle proof for slot 1
    const leaf = hashSlotLeaf(rafflePubkey, 1, PublicKey.default);
    const proofResponse = await rpc.getValidityProof([leaf]);
    const proof = proofResponse.merkleProofs[0];

    // 3. Join with proof
    await program.methods
      .unsafeJoinRaffle([1], lamports(0.1), [proof])
      .accounts({
        // ... accounts ...
        lightMerkleTree: tree.address,
      })
      .rpc();

    // Verify user owns slot
    const userRaffle = await program.account.userRaffle.fetch(userRafflePda);
    assert.deepEqual(userRaffle.slots, [1]);
  });
});
```

## 📚 Client SDK Changes

### Before (Vec-based)

```typescript
// Simple - no proofs needed
await program.methods
  .unsafeJoinRaffle([1, 5, 10], amount)
  .accounts({ ... })
  .rpc();
```

### After (ZK-compressed)

```typescript
import { createRpc, bn } from "@lightprotocol/stateless.js";

async function joinRaffleCompressed(
  program: Program,
  rafflePubkey: PublicKey,
  slotIds: number[],
  amount: BN,
) {
  // 1. Initialize Light RPC
  const rpc = createRpc(connection.rpcEndpoint);

  // 2. Fetch raffle to get merkle_tree address
  const raffle = await program.account.raffle.fetch(rafflePubkey);
  const slots = await program.account.raffleSlots.fetch(slotsPda);

  // 3. Generate Merkle proofs for each slot
  const proofs = [];
  for (const slotId of slotIds) {
    // Hash empty slot leaf
    const leaf = hashSlotLeaf(rafflePubkey, slotId, PublicKey.default);

    // Get proof from Light indexer
    const proofResponse = await rpc.getValidityProof([leaf]);
    proofs.push(proofResponse.merkleProofs[0]);
  }

  // 4. Send transaction with proofs
  return await program.methods
    .unsafeJoinRaffle(slotIds, amount, proofs)
    .accounts({
      payer: wallet.publicKey,
      config: configPda,
      raffle: rafflePubkey,
      slots: slotsPda,
      userRaffle: userRafflePda,
      lightMerkleTree: slots.merkleTree,
      lightSystemProgram: LIGHT_PROGRAM_ID,
      treasury: treasuryPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

// Helper: Hash slot leaf (must match Rust implementation)
function hashSlotLeaf(
  raffle: PublicKey,
  slotId: number,
  owner: PublicKey,
): Buffer {
  const data = Buffer.concat([
    raffle.toBuffer(),
    Buffer.from(new Uint32Array([slotId]).buffer),
    owner.toBuffer(),
  ]);

  // Use Poseidon hash (Light Protocol standard)
  return poseidonHash(data);
}
```

## 🚀 Deployment

1. **Build:**

   ```bash
   anchor build
   ```

2. **Deploy:**

   ```bash
   anchor deploy --provider.cluster devnet
   ```

3. **Initialize Light tree:**

   ```bash
   # Use Light CLI to create state tree
   light-cli create-tree --depth 20 --canopy 10
   ```

4. **Test with 1M slots:**
   ```bash
   anchor test
   ```

## ✅ Success Criteria

- [ ] Can host raffle with 1,000,000 slots
- [ ] Rent cost < 0.01 SOL (vs 220 SOL before)
- [ ] Join instruction works with valid proofs
- [ ] Join fails with invalid/stale proofs
- [ ] Two-phase draw completes successfully
- [ ] Winner can claim prize
- [ ] All existing features (refund, withdraw) still work

## 📖 Additional Resources

- [Light Protocol Docs](https://www.zkcompression.com/)
- [Compressed PDAs Guide](https://www.zkcompression.com/compressed-pdas/overview)
- [Light SDK Rust Docs](https://docs.rs/light-sdk/)
- [Example: Token Distribution](https://github.com/Lightprotocol/example-token-distribution)

## 🤝 Support

For Light Protocol integration questions:

- Discord: https://discord.gg/lightprotocol
- GitHub: https://github.com/Lightprotocol/light-protocol

---

**Status:** Implementation guide complete. Ready for development.

**Next:** Start with Step 2 (modify `RaffleSlots`) and work through each step sequentially.
