# Multi-Raffle ZK-Compression Quick Start

## 🎯 What This Solves

**Problem:** Current `multi_raffle` can't create raffles with more than ~1000 slots due to Solana account size limits.

**Solution:** Use Light Protocol's zk-compression to store slot ownership in a Merkle tree instead of a Vec, enabling **millions of slots** with constant on-chain storage.

## 📊 Impact

| Metric             | Before   | After        |
| ------------------ | -------- | ------------ |
| Max slots          | 1,000    | 1,000,000+   |
| Storage (1M slots) | 32 MB ❌ | 100 bytes ✅ |
| Rent (1M slots)    | ~220 SOL | ~0.001 SOL   |

## 🏗️ How It Works

### Storage Change

**Before:**

```rust
RaffleSlots {
    slot_owners: Vec<Pubkey>  // [owner1, owner2, ..., ownerN]
}
// Size grows with N
```

**After:**

```rust
RaffleSlots {
    merkle_tree: Pubkey,      // Reference to Light tree
    slots_root: [u8; 32],     // Merkle root
}
// Size is constant (100 bytes)
```

### Join Flow Change

**Before:**

```rust
// Direct Vec write
slots.slot_owners[slot_id - 1] = payer;
```

**After:**

```rust
// Proof-based update
1. Client generates Merkle proof that slot is empty
2. Program verifies proof against current root
3. CPI to Light to update compressed state
4. Update root
```

## 📁 Files Created

1. **`ZK_COMPRESSION_DESIGN.md`** - Complete technical design
2. **`README_ZK_IMPLEMENTATION.md`** - Step-by-step implementation guide
3. **`src/zk_types.rs`** - ZK compression types (SlotLeaf, MerkleProof, etc.)
4. **`Cargo.toml`** - Updated with Light Protocol dependencies ✅

## 🚀 Implementation Checklist

Follow `README_ZK_IMPLEMENTATION.md` for detailed steps:

- [x] Step 1: Add Light dependencies (DONE)
- [ ] Step 2: Modify `RaffleSlots` structure
- [ ] Step 3: Add `WinnerSlotPicked` status
- [ ] Step 4: Update `unsafe_host_raffle`
- [ ] Step 5: Rewrite `unsafe_join_raffle` with proofs
- [ ] Step 6: Split `draw_raffle` into two phases
- [ ] Step 7: Add `finalize_winner` instruction
- [ ] Step 8: Update module structure
- [ ] Step 9: Remove old Vec-based logic
- [ ] Step 10: Write tests
- [ ] Step 11: Update client SDK
- [ ] Step 12: Deploy and test with 1M slots

## 🧪 Quick Test

After implementation, test with:

```bash
# Build
anchor build

# Test 1M slot raffle
anchor test -- --features test-1m-slots

# Expected: Success with <0.01 SOL rent
```

## 📚 Key Concepts

### Merkle Tree Storage

- Each slot is a **leaf** in Light's compressed tree
- Leaf = `hash(raffle_id, slot_id, owner)`
- Tree stores commitment (root) on-chain
- Full tree data indexed by Light RPC

### Proof-Based Updates

- Client fetches current tree state from Light RPC
- Generates Merkle proof for slot
- Submits proof with transaction
- Program verifies proof before updating

### Two-Phase Draw

1. **Pick slot:** Deterministic random selection
2. **Finalize winner:** Prove who owns that slot

## 🔗 Resources

- **Design Doc:** `ZK_COMPRESSION_DESIGN.md`
- **Implementation Guide:** `README_ZK_IMPLEMENTATION.md`
- **Light Protocol:** https://www.zkcompression.com/
- **Compressed PDAs:** https://www.zkcompression.com/compressed-pdas/overview

## ⚡ Next Steps

1. Read `ZK_COMPRESSION_DESIGN.md` for architecture overview
2. Follow `README_ZK_IMPLEMENTATION.md` step-by-step
3. Start with Step 2 (modify `RaffleSlots`)
4. Test incrementally after each step

---

**Status:** Ready for implementation. All design docs and starter code created.

**Estimated Time:** 2-3 days for full implementation + testing.
