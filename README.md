# RWA Raffle (Cross-Chain)

This monorepo contains a cross-chain RWA raffle system with network-specific implementations:

**Core Concept:**

- Participants deposit MOGA tokens into an escrow.
- When the required amount is reached before the deadline, a randomness draw selects a winning ticket.
- If the deadline passes without reaching the threshold, deposits are refundable.

## Network Branches

Each blockchain has its own branch with tailored implementation:

- **`main` / `solana`** — Solana implementation (Light zk-compression + Arcium randomness)
- **`casper-network`** — Casper Network implementation
- **`evm`** — EVM implementation _(coming soon)_

**Switch branches to view network-specific code and documentation.**

---

## Network-Specific Details

### Solana (`main` / `solana` branch)

**Tech Stack:**

- Anchor program for smart contracts
- Light Protocol zk-compression for scalable participant/ticket state
- Arcium MPC for verifiable randomness generation

**Packages:**

- `programs/rwa_raffle/` — Anchor program
- `ts-sdk/` — TypeScript SDK (bun-compatible)
- `offchain/` — Worker for Arcium + Light integration
- `docs/` — Architecture docs and SVG diagrams

**Key Features:**

- SPL Token / Token-2022 support via `anchor-spl` token interface
- Compressed accounts for efficient state management
- MPC-based randomness with on-chain callback settlement

**Status:**

- Initial program scaffolding with escrow and ticket accounting
- Randomness and compressed accounts integration in progress

---

### Casper Network (`casper-network` branch) ⭐ CURRENT

**Tech Stack:**

- Odra framework (Rust-based smart contracts)
- Native Casper randomness mechanisms
- CEP-18 token standard for MOGA

**Packages:**

- `contracts/+odra_another_mint/` — Sample Odra contract (test deployment)
- `contracts/+odra_authority_mint/` — Authority mint wrapper contract
- `contracts/$moga-collection/` — NFT collection contracts (planned)
- `scripts/` — Casper deployment and interaction scripts
- `docs/casper/` — Casper-specific documentation

**Key Features:**

- Odra framework for clean, testable contract development
- Casper's deterministic deployment and upgrade model
- Native account-based architecture
- Gas-efficient refund mechanisms
- Authority-based delegated minting for NFT collections

**Status:**

- ✅ Odra contracts compiling (`+odra_another_mint`, `+odra_authority_mint`)
- 🚀 Ready for testnet deployment
- 📝 MOGA token + NFT collection contracts in progress

---

### EVM Chains (`polygon`, `lisk` branches)

**Tech Stack:**

- Solidity smart contracts
- Chainlink VRF for verifiable randomness
- ERC-20 token standard for MOGA

**Packages:**

- `contracts/` — Solidity contracts (Hardhat/Foundry)
- `sdk/` — ethers.js/viem-based SDK
- `docs/evm/` — EVM-specific documentation

**Key Features:**

- Multi-chain deployment (Polygon, Lisk, and other EVM-compatible chains)
- Chainlink VRF integration for randomness
- Gas-optimized batch operations

**Status:**

- Branches pending creation

---

## General Prerequisites

- **Bun** (preferred package manager)
- **Git** for branch management

### Network-Specific Prerequisites

**Solana:**

- Rust 1.70+
- Solana CLI 2.3.x
- Anchor CLI 0.31.1

**Casper:**

- Rust nightly (required for Odra 2.4.0)
- `cargo-odra` CLI (`cargo install cargo-odra --locked`)
- `casper-client` 5.0.0+ (`cargo install casper-client`)
- Casper testnet account with CSPR tokens

**EVM (Polygon, Lisk):**

- Node.js 18+
- Hardhat or Foundry
- Wallet with testnet tokens

---

## Development Notes

### Solana

- Program uses `anchor-spl` token interface to support both SPL Token and Token-2022 mints
- MOGA mint can be either Token or Token-2022; SDK auto-detects via interface
- Randomness and zk-compression integration staged for minimal v0
- See `docs/architecture.md` and `docs/architecture.svg` for flow

### Casper

- Contracts built with Odra framework (v2.4.0)
- Uses CEP-18 fungible token standard for MOGA
- Account-based model simplifies participant tracking
- Nightly Rust required: `rustup override set nightly` in repo root
- Build contracts: `cargo build --manifest-path contracts/+odra_another_mint/Cargo.toml`
- Deploy via `casper-client` or Odra livenet integration
- See `docs/casper/` for Casper-specific architecture

### EVM

- Contracts use OpenZeppelin libraries for security
- Chainlink VRF subscription required for randomness
- Multi-chain deployment via shared contract base
- See `docs/evm/` for EVM-specific architecture _(branches: polygon, lisk)_

---

## Documentation Links

### Solana-Specific

- `docs/SIMPLIFIED_FLOW.md`
- `docs/decision-flow-v2.svg`
- `docs/REFUND_TICKET_SPEC.md`
- `docs/ZK_COMPRESSION_USAGE.md`
- `docs/RAFFLE_OPTIONS.md`

### Casper-Specific

- `docs/casper/` _(branch: casper-network)_

### EVM-Specific

- `docs/evm/` _(branches: polygon, lisk)_

---

## Automation Options (Solana)

See `docs/RAFFLE_OPTIONS.md` for full details. Summary:

- **Draw Triggers**

  - Auto on full (client-chained): append `request_draw_arcium` after join
  - Auto on full (worker): worker calls `request_draw_arcium` on `ThresholdReached`
  - Scheduled reveal: worker waits until `reveal_time_unix_ts`
  - Manual: any payer can call when `status == Drawing`

- **Refund Modes**

  - Auto (worker crank): call `refund_batch()` at deadline; mint MRFT from events
  - Self-service: users call `claim_refund()`; worker mints MRFT
  - Hybrid: both enabled

- **Notifications**

  - Winners: after `draw_callback`
  - Refunds: after `RefundTicketsRequested` / mint

- **Config (to add)**
  - `auto_draw_on_full: bool`
  - `reveal_time_unix_ts: Option<i64>`
  - `refund_mode: enum { Auto, SelfService, Hybrid }`
  - `prize_mode: enum { PreEscrow, MintOnClaim }`

_Note: Casper and EVM implementations will have similar automation options with network-specific adaptations._
