# Mogate RWA Platform - Multi-chain RWA Raffle

This monorepo contains the Mogate RWA raffle platform across multiple chains. Each network has its own git branch with network-specific programs, SDKs, and offchain workers.

## Network Branches

This is a cross-chain project. Each blockchain has its own branch:

- **`solana-network`** — Solana implementation
- **`evm-network`** — EVM implementation (LISK, polygon, base, etc )

**Switch branches to view network-specific code and documentation.**

---

## iExec + Privacy 2.0 (References)

This repo includes iExec integration references for Privacy 2.0 work:

- **Privacy contracts** live under `contracts/RaffleTEE.sol`
- **Scripts** live under `scripts/tee`
- **TypeScript SDK** support lives under `ts-sdk/iexec`

These are references for the integration and are meant to be explored within their respective folders.

## Transparent Raffle Contract

The transparent raffle implementation is in `contracts/Raffle.sol`. This is the on-chain raffle logic and serves as the source of truth for the transparent raffle flow.

## Offchain, SDK, and Scripts (How They Relate)

- **Offchain** (`offchain/`): the off-chain service layer.
- **TS SDK** (`ts-sdk/`): the client application SDK used to interact with on-chain and off-chain components.
- **Scripts** (`scripts/`): utility scripts that can pull and process data via the TS SDK (client-app) and related services.
