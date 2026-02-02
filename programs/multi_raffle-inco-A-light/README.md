# Multi-Raffle Light (Modularized)

## 🎯 Overview

This is a **modularized version** of `multi_raffle-light` with ZK-compression support, following the clean instruction pattern from `raffle-example-solana`.

## 📁 Project Structure

```
src/
├── lib.rs                      # Main program entry (thin wrapper)
├── error.rs                    # Error codes
├── zk_types.rs                 # ZK compression types (SlotLeaf, MerkleProof)
├── state/
│   ├── mod.rs
│   ├── config.rs              # Global config
│   ├── raffle.rs              # Raffle account + enums
│   ├── raffle_slots.rs        # ZK-compressed slots (Merkle root)
│   └── user_raffle.rs         # Per-user raffle data
└── instructions/
    ├── mod.rs
    ├── initialize_config.rs   # Setup admin + fees
    ├── unsafe_host_raffle.rs  # Create raffle with ZK tree
    ├── unsafe_join_raffle.rs  # Join with Merkle proofs
    ├── draw_raffle.rs         # Phase 1: Pick winner slot
    ├── finalize_winner.rs     # Phase 2: Prove winner
    ├── claim.rs               # Winner claims prize
    ├── withdraw_proceeds.rs   # Admin withdraws
    ├── claim_refund.rs        # User refunds
    ├── get_raffle_load.rs     # View helper
    └── get_user_raffle_slots.rs # View helper
```

## ✨ Benefits of Modularization

### Before (Monolithic)

- ❌ 1500+ line `lib.rs` file
- ❌ Hard to navigate
- ❌ Difficult to test individual instructions
- ❌ Merge conflicts in team development

### After (Modularized)

- ✅ Each instruction in its own file (~50-100 lines)
- ✅ Clear separation of concerns
- ✅ Easy to find and modify specific logic
- ✅ Better for team collaboration
- ✅ Follows Anchor best practices

## 🔧 Pattern

Each instruction follows this structure:

```rust
// instructions/example.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;

#[derive(Accounts)]
pub struct Example<'info> {
    // Account constraints here
}

pub fn handler(ctx: Context<Example>, params: ...) -> Result<()> {
    // Logic here
    Ok(())
}
```

Then in `lib.rs`:

```rust
pub fn example(ctx: Context<Example>, params: ...) -> Result<()> {
    instructions::example::handler(ctx, params)
}
```

## 🚀 Implementation Status

### ✅ Completed

- [x] Project structure
- [x] State modules (config, raffle, raffle_slots, user_raffle)
- [x] Error codes
- [x] ZK types (from parent directory)
- [x] `initialize_config` instruction
- [x] `unsafe_host_raffle` instruction (ZK-compressed)
- [x] Main `lib.rs` with all instruction stubs

### ⏳ TODO

- [ ] Complete `unsafe_join_raffle` with proof verification
- [ ] Complete `draw_raffle` (Phase 1)
- [ ] Complete `finalize_winner` (Phase 2)
- [ ] Complete `claim` with prize minting
- [ ] Complete `withdraw_proceeds`
- [ ] Complete `claim_refund`
- [ ] Complete view helpers
- [ ] Write tests for each instruction
- [ ] Integration tests

## 📚 Key Differences from Parent

### 1. Structure

- **Parent (`multi_raffle-light`)**: Single 1500-line `lib.rs`
- **This**: Modularized into ~10 files

### 2. Maintainability

- Each instruction is self-contained
- Easy to add new instructions
- Clear dependencies between modules

### 3. Testing

- Can test individual instruction handlers
- Mock contexts more easily
- Better unit test coverage

## 🔗 Related Files

- **Parent Design**: `../multi_raffle-light/ZK_COMPRESSION_DESIGN.md`
- **Implementation Guide**: `../multi_raffle-light/README_ZK_IMPLEMENTATION.md`
- **ZK Types**: `./src/zk_types.rs` (copied from parent)

## 🎓 Learning Resources

- **Pattern Reference**: `/Users/dellwatson/Desktop/solana-integration/raffle-example-solana`
- **Anchor Docs**: https://www.anchor-lang.com/docs/
- **Light Protocol**: https://www.zkcompression.com/

## 🚀 Next Steps

1. Complete remaining instruction handlers (follow pattern in `unsafe_host_raffle.rs`)
2. Add comprehensive tests for each instruction
3. Deploy to devnet
4. Test with 1M slot raffle

---

**Status**: Structure complete, ready for instruction implementation

**Pattern**: Modularized following `raffle-example-solana` best practices
