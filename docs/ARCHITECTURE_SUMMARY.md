# RWA Raffle - Architecture Summary & Answers

## Questions & Answers

### 1. Is it already using the latest SDK (Pinocchio)?

**Answer: NO, and you DON'T need Pinocchio.**

Your project uses **Anchor 0.31.1**, which is the latest stable Anchor framework. Pinocchio is a different, lower-level SDK for Solana programs that focuses on zero-copy deserialization and minimal runtime overhead.

**Current Dependencies (All Latest):**
- ✅ `anchor-lang: 0.31.1` (latest stable)
- ✅ `anchor-spl: 0.31.1` (latest stable)
- ✅ `arcium-anchor: 0.3.0` (latest)
- ✅ `arcium-client: 0.3.0` (latest)
- ✅ `arcium-macros: 0.3.0` (latest)
- ✅ `light-sdk: 0.16.0` (latest)
- ✅ `light-hasher: 5.0.0` (latest)

**Why you don't need Pinocchio:**
- Anchor provides excellent abstractions for your use case
- Pinocchio is for ultra-low-level optimization (not needed here)
- Your program complexity doesn't warrant the added complexity
- Anchor's Token Interface already handles SPL Token + Token-2022

---

### 2. Is Anchor + Metaplex + Arcium + ZK-Compression enough?

**Answer: YES, that's the perfect stack.**

**Current Stack:**
- ✅ **Anchor 0.31.1** - Core program framework
- ✅ **Arcium 0.3.0** - Verifiable randomness (MPC)
- ✅ **Light Protocol 0.16.0** - ZK compression for scalability
- ⏳ **Metaplex** - Not yet integrated (for NFT metadata)

**What you have:**
```rust
// Already integrated:
use anchor_lang::prelude::*;                    // ✅ Anchor
use arcium_anchor::prelude::*;                  // ✅ Arcium
use light_sdk::{...};                           // ✅ Light Protocol
use anchor_spl::token_interface::{...};         // ✅ Token support
```

**What you need to add (optional):**
```toml
# For NFT metadata (when you need it):
mpl-token-metadata = "4.1.2"
```

**Stack Completeness:**
- ✅ **Token handling**: anchor-spl (SPL Token + Token-2022)
- ✅ **Randomness**: Arcium MPC with encrypted instructions
- ✅ **Scalability**: Light Protocol compressed accounts
- ⏳ **NFT metadata**: Add Metaplex when implementing RWA NFT features
- ✅ **State management**: Anchor accounts + PDAs

---

### 3. Full Architecture Flowcharts

Created **4 comprehensive SVG diagrams**:

#### A. Full Architecture Flow (`full-architecture-flow.svg`)
- 5-layer architecture visualization
- Layer 1: Client & Frontend
- Layer 2: Solana Program (Anchor)
- Layer 3: Protocol Integrations (Arcium + Light)
- Layer 4: Token & Asset Layer
- Layer 5: Offchain Infrastructure
- Shows all data flows and dependencies

#### B. Decision Flow (`decision-flow.svg`)
- Complete user journey from start to finish
- All decision points (compressed vs regular, threshold checks, deadline checks)
- Success paths (winner claims, prize distribution)
- Failure paths (refunds, deadline expiry)
- Arcium vs manual randomness flows

#### C. Integration Diagram (`integration-diagram.svg`)
- Detailed protocol integration architecture
- Arcium MPC integration (encrypted instructions, callbacks)
- Light Protocol integration (compressed accounts, proofs)
- Anchor SPL Token Interface
- Token layer (MOGA + Prize NFT)
- Bidirectional data flows

#### D. State Machine (`state-machine.svg`)
- 4 states: Selling, Drawing, Completed, Refunding
- State transitions with triggers
- Allowed instructions per state
- State enum values (0-3)

#### E. PDA Operations (`pda-operations.svg`)
- All PDA account types (Raffle PDA, Ticket PDA, Light CPI Signer)
- PDA derivation seeds and patterns
- PDA retrieval per instruction
- PDA signing patterns with code examples
- When PDAs delegate authority (escrow transfers, Light CPI)

---

### 4. Code Modularity - Should we keep 1 long file?

**Answer: NO, modularize it.**

**Current State:**
- 737 lines in single `lib.rs`
- 9 instructions + state + errors + events
- Acceptable for v0, but not scalable

**Recommended Structure (Option A - Moderate Modularity):**

```
programs/rwa_raffle/src/
├── lib.rs                    # Entry point (50 lines)
├── instructions/
│   ├── mod.rs
│   ├── initialize.rs        # initialize_raffle
│   ├── deposit.rs           # deposit, deposit_compressed
│   ├── draw.rs              # request_draw, request_draw_arcium, draw_callback
│   ├── settle.rs            # settle_draw
│   ├── claim.rs             # claim_refund, claim_win
│   └── prize.rs             # set_prize_nft, claim_prize
├── state/
│   ├── mod.rs
│   ├── raffle.rs            # Raffle account
│   ├── ticket.rs            # Ticket & TicketCompressed
│   └── constants.rs         # Seeds, constants
├── errors.rs                # Error enums
├── events.rs                # Event structs
└── utils/
    ├── mod.rs
    └── validation.rs        # Validation helpers
```

**Benefits:**
- ✅ Each file 50-100 lines (easy to navigate)
- ✅ Clear separation of concerns
- ✅ Better for team collaboration
- ✅ Easier to test individual components
- ✅ Follows Anchor best practices
- ✅ Scalable for future features

**Migration Effort:** 2-3 hours

**When to do it:** Before adding more features (Metaplex, batch operations, etc.)

See `docs/modularity-proposal.md` for detailed migration plan.

---

## Architecture Highlights

### Core Components

1. **Raffle Program (Anchor)**
   - 9 core instructions
   - PDA-based state management
   - Token Interface for SPL + Token-2022
   - Escrow mechanism via ATA

2. **Arcium MPC Integration**
   - Encrypted instruction: `draw(required_tickets) -> winner_ticket`
   - Computation definition initialization
   - Queue computation with callbacks
   - Verifiable randomness generation

3. **Light Protocol Integration**
   - Compressed ticket accounts (`TicketCompressed`)
   - Merkle tree state proofs
   - `LightSystemProgramCpi` for operations
   - Scalable to 1000s of participants

4. **Token Layer**
   - MOGA token (SPL or Token-2022)
   - 1 whole token = 1 raffle ticket
   - Escrow ATA owned by raffle PDA
   - Optional Prize NFT (decimals = 0)

### State Machine

```
SELLING (0) ──[threshold met]──> DRAWING (1) ──[RNG complete]──> COMPLETED (2)
    │                                                                   │
    └──[deadline passed]──> REFUNDING (3)                              │
                                                                        │
                                                            [winner claims prize]
```

### Data Flow

```
Client (TS SDK)
    ↓ [transactions]
Raffle Program
    ├──> Arcium MPC [queue_computation] ──> [draw_callback]
    ├──> Light Protocol [compressed accounts] ──> [validity proofs]
    ├──> Token Program [escrow transfers]
    └──> Offchain Worker [event monitoring]
```

---

## Key Features

### ✅ Implemented
- Initialize raffle with deadline and ticket requirements
- Deposit tokens (regular PDA or compressed)
- Automatic threshold detection
- Arcium MPC randomness integration
- Manual randomness fallback
- Refund mechanism for failed raffles
- Winner claim system
- Prize NFT escrow and distribution

### 🚧 Future Enhancements
- Metaplex NFT metadata integration
- Batch claim operations
- Multiple prize tiers
- Recurring raffles
- Cross-program invocations

---

## Dependencies Summary

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **Core** | anchor-lang | 0.31.1 | Program framework |
| **Core** | anchor-spl | 0.31.1 | Token operations |
| **Randomness** | arcium-anchor | 0.3.0 | MPC integration |
| **Randomness** | arcium-client | 0.3.0 | Client SDK |
| **Randomness** | arcium-macros | 0.3.0 | Proc macros |
| **Randomness** | arcis-imports | 0.3.0 | Encrypted ixs |
| **Compression** | light-sdk | 0.16.0 | ZK compression |
| **Compression** | light-hasher | 5.0.0 | Merkle trees |
| **NFT** | mpl-token-metadata | TBD | Future: NFT metadata |

---

## Files Created

1. **`docs/full-architecture-flow.svg`** - Complete 5-layer architecture
2. **`docs/decision-flow.svg`** - User journey and decision tree
3. **`docs/integration-diagram.svg`** - Protocol integration details
4. **`docs/state-machine.svg`** - State transitions and rules
5. **`docs/pda-operations.svg`** - PDA derivation, retrieval & signing patterns
6. **`docs/modularity-proposal.md`** - Code organization guide
7. **`docs/ARCHITECTURE_SUMMARY.md`** - This document
8. **`docs/INDEX.md`** - Quick reference index

---

## Recommendations

### Immediate Actions
1. ✅ **Keep current dependencies** - All are latest and appropriate
2. ✅ **No need for Pinocchio** - Anchor is perfect for your use case
3. 🔄 **Modularize code** - Split lib.rs into modules (2-3 hours)
4. ⏳ **Add Metaplex later** - When implementing NFT metadata features

### Future Considerations
1. **Testing**: Add integration tests for each instruction
2. **Security**: Audit before mainnet (especially Arcium callbacks)
3. **Optimization**: Profile CU usage for compressed vs regular deposits
4. **Monitoring**: Implement offchain worker for production
5. **Documentation**: Add inline docs for public APIs

---

## Conclusion

Your RWA raffle architecture is **well-designed and uses the right stack**:
- ✅ Latest Anchor framework (no Pinocchio needed)
- ✅ Proper integration of Arcium + Light Protocol
- ✅ Ready for Metaplex when needed
- 🔄 Should modularize code for maintainability
- ✅ Scalable architecture for production

The flowcharts and diagrams provide a complete visual reference for the entire system architecture, decision flows, and integration patterns.
