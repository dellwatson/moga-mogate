# Mogate RWA Platform - Multi-chain RWA Raffle

This monorepo contains the Mogate RWA raffle platform across multiple chains. Each network has its own git branch with network-specific programs, SDKs, and offchain workers.

## Network Branches

This is a cross-chain project. Each blockchain has its own branch:

- **`main` / `svm`** — Solana implementation
- **`aleo-network`** — Aleo implementation (this branch)
- **`casper-network`** — Casper Network implementation
- **`evm-network`** — EVM implementation (LISK, polygon, base, etc )
- **`bridge-hub`** — Cross-chain middleware / bridging layer

**Switch branches to view network-specific code and documentation.**

---

# Aleo RWA Raffle (Testnet3)

This branch contains the **Aleo implementation** of the Mogate RWA raffle system:

- Privacy-preserving NFT collections using Leo smart contracts.
- Authority minting with role-based access control.
- Multi-raffle engine using Aleo credits.
- TypeScript SDK powered by **DokoJS** for seamless Aleo integration.
- Scripts to deploy, mint, burn, and manage NFTs on Aleo testnet.

## Programs

### `programs/collection/` — Privacy-preserving NFT collection

**Location**: `programs/collection/src/main.leo`

Leo program implementing ARC-721-style NFT collection with privacy features.

- **NFT Records**: Private NFT ownership using Aleo's record model
- **Role Management**: Owner, operators, and minters with public mapping-based access control
- **Minting**: Auto-increment (`mint_to`) or specific token ID (`mint_with_token_id`)
- **Transfer & Burn**: Standard NFT operations with privacy preservation
- **Public Mappings**: Track token ownership and metadata on-chain

**Key Transitions**:

- `initialize(owner)` — Initialize collection with owner
- `set_operator(operator, allowed)` — Manage operator permissions
- `set_minter(minter, allowed)` — Manage minter permissions
- `mint_to(to, uri_hash)` — Mint with auto-incrementing ID
- `mint_with_token_id(to, token_id, uri_hash)` — Mint with specific ID
- `transfer(nft, to)` — Transfer NFT ownership
- `burn(nft)` — Burn NFT

### `programs/authority_mint_gateway/` — Minting authority gateway

**Location**: `programs/authority_mint_gateway/src/main.leo`

Gateway program for managing cross-collection minting authority.

- **Collection Allowlist**: Owner-controlled collection permissions via public mappings
- **Authority Minting**: Owner-only controlled mints with permission checks
- **Faucet Mode**: Open-access minting for testing (`mint_nft`)

**Key Transitions**:

- `initialize(owner)` — Initialize gateway with owner
- `set_collection_allowed(collection, allowed)` — Manage allowed collections
- `mint(collection, to, uri_hash, token_id)` — Authority mint (owner + allowlist check)
- `mint_nft(collection, to, uri_hash, token_id)` — Faucet mint (no checks)

### Raffle Program (Coming Soon)

Aleo implementation of the chain-agnostic spec in `RAFFLE.md` using privacy-preserving raffle mechanics with Aleo credits.

## TypeScript SDK with DokoJS

The `ts-sdk/` directory contains TypeScript utilities for interacting with Aleo programs, powered by **DokoJS**.

### What is DokoJS?

**DokoJS** is a powerful and lightweight library for seamless interaction with the Aleo blockchain. It provides:

- **Type-safe Leo program interactions** — Auto-generated TypeScript types from Leo programs
- **Simplified deployment** — Easy program compilation and deployment to testnet/mainnet
- **Testing framework** — Built-in Jest integration for testing Leo transitions
- **Record management** — Utilities for encrypting/decrypting private records
- **Multi-network support** — Configure testnet3, mainnet, or local networks

### Installation

```bash
# Install DokoJS CLI globally
npm install -g @doko-js/cli@latest

# Or use in project
bun add @doko-js/core @provablehq/sdk
```

### Key Features in this SDK

- **`authorityMint.ts`** — Authority minting utilities
- **`collectionUtils.ts`** — Collection interaction helpers
- **`src/`** — Auto-generated types and contract wrappers from Leo programs
- **`tests/`** — Test suites for collection and authority programs

### Usage Example

```typescript
import { ExecutionMode } from "@doko-js/core";
import { CollectionContract } from "./artifacts/js/collection";

const mode = ExecutionMode.SnarkExecute;
const contract = new CollectionContract({ mode });

// Deploy program
const tx = await contract.deploy();
await tx.wait();

// Mint NFT
const mintTx = await contract.mint_to(recipientAddress, uriHash);
await mintTx.wait();
```

See `ts-sdk/README.md` and `token/README.md` for detailed DokoJS documentation.

## Deployment

For concrete deployments (addresses + tx hashes), see:

- `DEPLOYMENT.md` — Aleo testnet3 deployment guide

## Network Configuration

- **Aleo Testnet3**

  - Network: `testnet3`
  - Explorer: https://explorer.aleo.org/
  - API Endpoint: `https://api.explorer.aleo.org/v1`
  - Programs deployed: Collection, Authority Mint Gateway
  - Full deployment log: `DEPLOYMENT.md`

- **Local Development**
  - Use Docker for isolated Leo development environment
  - Docker Compose configuration included
  - Local testnet support via `snarkOS`

## Prerequisites

### Required Tools

- **Rust** — Leo compiler requires Rust toolchain ([Install Guide](https://www.rust-lang.org/tools/install))
- **Leo** — Aleo smart contract language ([Install Guide](https://github.com/ProvableHQ/leo))
- **Bun** >= 1.0 — For TypeScript SDK and scripts
- **Docker** (Optional) — Recommended for isolated development environment

### Installation

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Leo from source
git clone --recurse-submodules https://github.com/ProvableHQ/leo
cd leo
cargo install --path .

# Verify installation
leo --version

# Install DokoJS CLI
npm install -g @doko-js/cli@latest
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Aleo private key for deployment
ALEO_PVT_KEY=APrivateKey1...

# Optional: Additional keys for testing
ALEO_PRIVATE_KEY_TESTNET3=APrivateKey1...
ALEO_DEVNET_PRIVATE_KEY2=APrivateKey1...
```

## Quick Start

### Using Docker (Recommended)

```bash
# Build and start container
docker-compose build
docker-compose run --rm aleo-dev

# Inside container, deploy programs
chmod +x /workspace/scripts/deploy-collection.sh
/workspace/scripts/deploy-collection.sh

chmod +x /workspace/scripts/deploy-gateway.sh
/workspace/scripts/deploy-gateway.sh
```

### Local Development

```bash
# Build programs
cd programs/collection
leo build

cd ../authority_mint_gateway
leo build

# Run tests with DokoJS
cd ../../ts-sdk
bun install
bun test

# Deploy to testnet3
cd ../programs/collection
leo deploy --network testnet3 --private-key "$ALEO_PVT_KEY"
```

## Development Notes

- **Privacy by Default**: NFT ownership uses Aleo's private record model
- **URI Storage**: Metadata URIs stored as `field` (hash) instead of strings
- **Two-Phase Execution**: Transitions execute off-chain, finalize blocks update on-chain state
- **No Events**: Use public mappings for queryable state; off-chain indexers track changes
- **Token IDs**: Typically unix-ms timestamps chosen offchain (same as other chains)
- **Metadata**: URIs point at GitHub raw JSON files under `metadata/v2-test/...`
- **Cross-chain Design**: Raffle engine mirrors Casper/Solana logic for unified offchain service
- **DokoJS Integration**: Auto-generates TypeScript types from Leo programs for type-safe interactions

## Key Differences from EVM

1. **Privacy**: Records provide private state; public mappings for queryable data
2. **Access Control**: Implemented via public mappings and assertions (`self.caller`)
3. **Gas Model**: Uses Aleo credits instead of ETH/MATIC gas
4. **Execution Model**: Off-chain proof generation + on-chain verification
5. **Type System**: Leo's strongly-typed system with `field`, `u64`, `address` types

## Resources

- **Aleo Developer Docs**: https://developer.aleo.org/
- **Leo Language Guide**: https://docs.leo-lang.org/
- **DokoJS Documentation**: https://github.com/venture23-aleo/doko-js
- **Aleo Explorer**: https://explorer.aleo.org/
- **Chain-agnostic Raffle Spec**: `RAFFLE.md`
