# Mogate RWA Platform - Multi-chain RWA Raffle

This monorepo contains the Mogate RWA raffle platform across multiple chains. Each network has its own git branch with network-specific programs, SDKs, and offchain workers.

## Network Branches

This is a cross-chain project. Each blockchain has its own branch:

- **`main` / `solana`** — Solana implementation ⭐ **YOU ARE HERE**
- **`casper-network`** — Casper Network implementation
- **`evm`** — EVM implementation
- **`bridge-hub`** — Cross-chain middleware / bridging layer

**Switch branches to view network-specific code and documentation.**

---

# Solana RWA Raffle (Privacy + Compression)

This branch contains the **Solana** implementation of the Mogate RWA raffle
platform, focused on privacy and scalability using:

- **Inco Lightning FHE** for private slot ownership and delayed transparency.
- **Light Protocol ZK Compression** for scalable, compressed ticket storage.

## Packages (Solana)

- `programs/` — all on-chain programs:
  - `programs/multi_raffle/` — baseline multi-raffle implementation.
  - `programs/multi_raffle_modularized/` — refactor with cleaner module boundaries.
  - `programs/multi_raffle-inco-A/` — ver-A raffle with Inco Lightning (FHE) only.
  - `programs/multi_raffle-inco-A-light/` — ver-A + Inco FHE **and** Light zk-compressed
    tickets (this is the variant used for the Privacy on Solana work).
  - `programs/multi_raffle-inco-B/` and `...-B-light/` — alternate layout / config
    experiments with and without LIGHT.
  - `programs/multi_raffle-inco-C/` and `...-C-light/` — further design variants
    exploring different privacy / compression tradeoffs.

- `ts-sdk/` — TypeScript SDK and helpers (bun-compatible) for clients.
- `scripts/` — executable scripts for hosting/joining raffles and running
  end-to-end flows. In particular, see `scripts/inco/verA-light` for the
  Inco + Light integration harness.
- `offchain/` — stubs for off-chain workers (randomness, automation, indexing).
- `docs/` — architecture notes, diagrams, and flow descriptions.

## Privacy on Solana Hackathon

For the **Privacy on Solana** hackathon, the focus is on the
`multi_raffle-inco-*` program family:

- **Inco Lightning** is used to store each user’s slot ownership as encrypted
  FHE handles (`Euint128`), supporting private joins, draws, and claims.
- **Light Protocol zk-compression** is used in the `*-light` variants to store
  per-user tickets as compressed accounts in Merkle trees instead of regular
  Solana accounts, enabling 1M+ slots per raffle.

Among these, the **primary reference implementation** is:

- `programs/multi_raffle-inco-A-light` — ver-A raffle with both Inco FHE and
  Light zk-compressed tickets.

For full details on how to **deploy** and **test** this variant on devnet,
including how to generate LIGHT proofs and run the host/join scripts, see:

- `scripts/inco/verA-light/README.md`
