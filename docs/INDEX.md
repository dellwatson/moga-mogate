### SDK Docs

- `ts-sdk/docs/DEVNET_SETUP.md` - Devnet token setup and SDK usage examples
# RWA Raffle Documentation Index

## 📋 Quick Reference

### Questions Answered
1. **SDK Status**: ✅ Using latest Anchor 0.31.1 - NO Pinocchio needed
2. **Stack Completeness**: ✅ Anchor + Arcium + Light Protocol (+ Metaplex later)
3. **Architecture Diagrams**: ✅ 4 comprehensive SVG flowcharts created
4. **Code Modularity**: 🔄 Recommended to modularize (see proposal)

---

## 📚 Documentation Files

### Core Documentation
- **[ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md)** - Complete answers to all questions
- **[SIMPLIFIED_FLOW.md](./SIMPLIFIED_FLOW.md)** - 1-transaction join flow (MOGA → USDC, slot reservation)
- **[architecture.md](./architecture.md)** - Original architecture overview
- **[integrations.md](./integrations.md)** - Integration implementation guide
- **[modularity-proposal.md](./modularity-proposal.md)** - Code organization recommendations
- **[usage.md](./usage.md)** - How to use the program
- **[roadmap.md](./roadmap.md)** - Development roadmap
 - **[REFUND_TICKET_SPEC.md](./REFUND_TICKET_SPEC.md)** - Refund NFT spec (tradeable, non-burnable by user)
 - **[RAFFLE_OPTIONS.md](./RAFFLE_OPTIONS.md)** - Automation vs self-service options (draw, refunds, notifications)
 - **[PROGRAM_STRUCTURE.md](./PROGRAM_STRUCTURE.md)** - Accounts, instructions, events, and roadmap

### Visual Diagrams (SVG)

#### 1. Full Architecture Flow
**File**: `full-architecture-flow.svg`  
**Purpose**: Complete 5-layer system architecture  
**Shows**:
- Layer 1: Client & Frontend (TypeScript SDK)
- Layer 2: Solana Program (Anchor)
- Layer 3: Protocol Integrations (Arcium + Light)
- Layer 4: Token & Asset Layer (MOGA + NFT)
- Layer 5: Offchain Infrastructure
- All data flows and dependencies

#### 2. Decision Flow (Canonical)
**File**: `decision-flow-v2.svg`  
**Purpose**: Simplified 1-transaction user journey  
**Shows**:
- Pick slots → Pay MOGA → Swap to USDC → Reserve slots (1 TX)
- Parallel deadline check and refund NFT minting when not full
- Winner selection via Arcium and prize claim

#### 3. Integration Diagram
**File**: `integration-diagram.svg`  
**Purpose**: Detailed protocol integration architecture  
**Shows**:
- Arcium MPC integration details
- Light Protocol compression flow
- Anchor SPL Token Interface
- Token layer architecture
- Bidirectional data flows
- Dependency versions

#### 4. State Machine
**File**: `state-machine.svg`  
**Purpose**: Raffle state transitions  
**Shows**:
- 4 states: Selling, Drawing, Completed, Refunding
- State transition triggers
- Allowed instructions per state
- State enum values

#### 5. PDA Operations
**File**: `pda-operations.svg`  
**Purpose**: PDA derivation, retrieval, and signing patterns  
**Shows**:
- All PDA account types (Raffle, Ticket, Light CPI Signer)
- PDA operations per instruction
- Signing patterns with code examples
- When PDAs are derived vs retrieved
- PDA delegation and authority usage

#### 6. Original Architecture (Legacy)
**File**: `architecture.svg`  
**Purpose**: Original simplified architecture diagram

---

## 🎯 Quick Answers

### 1. Do I need Pinocchio SDK?
**NO.** You're using Anchor 0.31.1 (latest stable). Pinocchio is for ultra-low-level optimization not needed here.

### 2. Is my stack complete?
**YES.** You have:
- ✅ Anchor 0.31.1 (core framework)
- ✅ Arcium 0.3.0 (verifiable randomness)
- ✅ Light SDK 0.16.0 (ZK compression)
- ⏳ Metaplex (add later for NFT metadata)

### 3. Where are the flowcharts?
All in `docs/` folder:
- `full-architecture-flow.svg` - Complete architecture
- `decision-flow.svg` - User journey
- `integration-diagram.svg` - Protocol integrations
- `state-machine.svg` - State transitions

### 4. Should I keep 1 long file?
**NO.** Modularize into:
- `instructions/` - One file per instruction group
- `state/` - Account structs
- `errors.rs` - Error enums
- `events.rs` - Event structs

See `modularity-proposal.md` for detailed plan.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│              (TypeScript SDK + Bun)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│              Raffle Program (Anchor)                     │
│  • 9 Instructions  • PDA State  • Token Escrow          │
└──┬──────────────┬──────────────┬─────────────────────┬──┘
   │              │              │                     │
   ↓              ↓              ↓                     ↓
┌──────┐    ┌──────────┐   ┌─────────┐         ┌──────────┐
│Arcium│    │  Light   │   │  Token  │         │ Offchain │
│ MPC  │    │Protocol  │   │Interface│         │  Worker  │
└──────┘    └──────────┘   └─────────┘         └──────────┘
```

---

## 📦 Dependencies

### Current (All Latest)
```toml
anchor-lang = "0.31.1"
anchor-spl = "0.31.1"
arcium-anchor = "0.3.0"
arcium-client = "0.3.0"
arcium-macros = "0.3.0"
arcis-imports = "0.3.0"
light-sdk = "0.16.0"
light-hasher = "5.0.0"
```

### Future (Optional)
```toml
mpl-token-metadata = "4.1.2"  # For NFT metadata
```

---

## 🔄 State Machine

```
SELLING (0)
    │
    ├─[threshold met]──> DRAWING (1)
    │                         │
    │                         └─[RNG complete]──> COMPLETED (2)
    │                                                   │
    └─[deadline passed]──> REFUNDING (3)               │
                                                        │
                                                   [winner claims]
```

---

## 🚀 Next Steps

### Immediate
1. ✅ Review architecture diagrams
2. 🔄 Modularize code (2-3 hours)
3. ✅ Verify all dependencies are latest
4. 📝 Add integration tests

### Future
1. ⏳ Add Metaplex for NFT metadata
2. ⏳ Implement batch claim operations
3. ⏳ Deploy offchain worker
4. ⏳ Security audit before mainnet

---

## 📖 How to Use This Documentation

### For Developers
1. Start with **ARCHITECTURE_SUMMARY.md** for complete overview
2. Review **decision-flow.svg** to understand user journeys
3. Check **integration-diagram.svg** for protocol details
4. Follow **modularity-proposal.md** to refactor code

### For Architects
1. Review **full-architecture-flow.svg** for system design
2. Check **state-machine.svg** for state management
3. Read **integrations.md** for implementation details
4. Review **roadmap.md** for future plans

### For Product Managers
1. Check **decision-flow.svg** for user experience
2. Review **usage.md** for feature set
3. Check **roadmap.md** for timeline
4. Review **ARCHITECTURE_SUMMARY.md** for tech stack

---

## 🎨 Diagram Legend

| Color | Meaning |
|-------|---------|
| 🔵 Blue | Core program / Active state |
| 🟡 Yellow | Processing / Decision point |
| 🟢 Green | Success / Completed |
| 🔴 Red | Error / Refund state |
| 🟣 Purple | Arcium MPC |
| 🔷 Cyan | Light Protocol |
| 🟠 Orange | Token layer |

---

## 📞 Support

For questions or issues:
1. Review relevant documentation file
2. Check SVG diagrams for visual reference
3. Refer to code comments in `programs/rwa_raffle/src/lib.rs`
4. Check Anchor, Arcium, and Light Protocol official docs

---

**Last Updated**: 2025-11-05  
**Version**: 1.0  
**Status**: Complete Architecture Documentation
