# Code Modularity Analysis & Proposal

## Current State (737 lines in lib.rs)

The current implementation has **all code in a single file** (`programs/rwa_raffle/src/lib.rs`):
- ✓ Simple to navigate initially
- ✓ Easy to understand flow
- ✗ Hard to maintain as features grow
- ✗ Difficult to test individual components
- ✗ Merge conflicts in team development

## Recommended Modular Structure

### Option A: Moderate Modularity (Recommended)

```
programs/rwa_raffle/src/
├── lib.rs                    # Program entry, module declarations (50 lines)
├── instructions/
│   ├── mod.rs               # Instruction module exports
│   ├── initialize.rs        # initialize_raffle
│   ├── deposit.rs           # deposit, deposit_compressed
│   ├── draw.rs              # request_draw, request_draw_arcium, draw_callback
│   ├── settle.rs            # settle_draw
│   ├── claim.rs             # claim_refund, claim_win
│   └── prize.rs             # set_prize_nft, claim_prize
├── state/
│   ├── mod.rs               # State module exports
│   ├── raffle.rs            # Raffle account struct
│   ├── ticket.rs            # Ticket & TicketCompressed structs
│   └── constants.rs         # Seeds, constants
├── errors.rs                # RaffleError, ArcError enums
├── events.rs                # All event structs
└── utils/
    ├── mod.rs
    └── validation.rs        # Common validation helpers
```

**Benefits:**
- ✓ Clear separation of concerns
- ✓ Each instruction in ~50-100 lines
- ✓ Easy to locate and modify specific features
- ✓ Better for team collaboration
- ✓ Testable modules

**Migration Effort:** ~2-3 hours

---

### Option B: Minimal Modularity (Quick Win)

```
programs/rwa_raffle/src/
├── lib.rs                    # Instructions only (300 lines)
├── state.rs                  # All account structs (200 lines)
├── errors.rs                 # Error enums (50 lines)
└── events.rs                 # Event structs (150 lines)
```

**Benefits:**
- ✓ Quick to implement (30 mins)
- ✓ Reduces lib.rs size significantly
- ✓ Minimal refactoring risk

**Drawbacks:**
- ✗ Instructions still in one file
- ✗ Limited scalability

---

### Option C: Maximum Modularity (Enterprise)

```
programs/rwa_raffle/src/
├── lib.rs                    # Entry point only
├── instructions/
│   ├── mod.rs
│   ├── raffle/
│   │   ├── mod.rs
│   │   ├── initialize.rs
│   │   └── settle.rs
│   ├── deposit/
│   │   ├── mod.rs
│   │   ├── regular.rs
│   │   └── compressed.rs
│   ├── draw/
│   │   ├── mod.rs
│   │   ├── request.rs
│   │   ├── arcium.rs
│   │   └── callback.rs
│   ├── claim/
│   │   ├── mod.rs
│   │   ├── refund.rs
│   │   └── win.rs
│   └── prize/
│       ├── mod.rs
│       ├── set.rs
│       └── claim.rs
├── state/
│   ├── mod.rs
│   ├── raffle.rs
│   ├── ticket.rs
│   └── constants.rs
├── contexts/
│   ├── mod.rs
│   ├── initialize.rs
│   ├── deposit.rs
│   ├── draw.rs
│   ├── claim.rs
│   └── prize.rs
├── errors.rs
├── events.rs
└── utils/
    ├── mod.rs
    ├── validation.rs
    └── helpers.rs
```

**Benefits:**
- ✓ Maximum organization
- ✓ Each file < 100 lines
- ✓ Perfect for large teams

**Drawbacks:**
- ✗ Over-engineered for current size
- ✗ More navigation overhead
- ✗ Higher migration effort (~1 day)

---

## Recommendation

**Use Option A (Moderate Modularity)** because:

1. **Current complexity warrants it**: 737 lines with 9 instructions + state + errors + events
2. **Future growth**: Adding Metaplex, more prize types, batch operations
3. **Team development**: Easier to work on different features simultaneously
4. **Testing**: Can unit test individual instruction modules
5. **Anchor best practices**: Most production Anchor programs use this structure

---

## Migration Plan

### Phase 1: Extract State & Errors (30 mins)
```rust
// lib.rs
mod state;
mod errors;
mod events;

use state::*;
use errors::*;
use events::*;
```

### Phase 2: Extract Instructions (1-2 hours)
```rust
// lib.rs
mod instructions;
use instructions::*;

#[arcium_program]
pub mod rwa_raffle {
    use super::*;
    pub use instructions::*;
}
```

### Phase 3: Add Utils (30 mins)
```rust
// utils/validation.rs
pub fn validate_deadline(deadline: i64) -> Result<()> {
    require!(deadline > Clock::get()?.unix_timestamp, RaffleError::InvalidDeadline);
    Ok(())
}
```

---

## Code Example: Modular Structure

### lib.rs (Entry Point)
```rust
use anchor_lang::prelude::*;

mod instructions;
mod state;
mod errors;
mod events;
mod utils;

pub use instructions::*;
pub use state::*;
pub use errors::*;
pub use events::*;

declare_id!("RwaRafLe1111111111111111111111111111111111111");

#[arcium_program]
pub mod rwa_raffle {
    use super::*;
    
    pub fn initialize_raffle(
        ctx: Context<InitializeRaffle>,
        required_tickets: u64,
        deadline_unix_ts: i64,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, required_tickets, deadline_unix_ts)
    }
    
    // ... other instruction wrappers
}
```

### instructions/initialize.rs
```rust
use anchor_lang::prelude::*;
use crate::{state::*, errors::*, events::*, utils::*};

pub fn handler(
    ctx: Context<InitializeRaffle>,
    required_tickets: u64,
    deadline_unix_ts: i64,
) -> Result<()> {
    require!(required_tickets > 0, RaffleError::InvalidAmount);
    utils::validation::validate_deadline(deadline_unix_ts)?;
    
    let raffle = &mut ctx.accounts.raffle;
    raffle.organizer = ctx.accounts.organizer.key();
    raffle.mint = ctx.accounts.mint.key();
    // ... rest of logic
    
    emit!(RaffleInitialized { /* ... */ });
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeRaffle<'info> {
    // ... accounts
}
```

---

## Testing Benefits

With modular structure, you can write focused tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_initialize_validation() {
        // Test only initialization logic
    }
    
    #[test]
    fn test_deposit_overflow() {
        // Test only deposit edge cases
    }
}
```

---

## Conclusion

**Answer to Question 4:**

> **Current state:** 1 long file (737 lines) - acceptable for v0 but not scalable
> 
> **Recommendation:** Modularize using Option A (Moderate)
> - Split into: instructions/, state/, errors.rs, events.rs
> - Each instruction in separate file (~50-100 lines)
> - Migration effort: 2-3 hours
> - Benefits: Maintainability, testability, team collaboration
> 
> **When to modularize:** Now or before adding more features (Metaplex, batch operations, etc.)

The current monolithic structure is fine for initial development, but as you add more features (Metaplex integration, advanced prize types, batch operations), modularization becomes essential.
