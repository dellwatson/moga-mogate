# Mogate RWA Platform - Casper Network

This monorepo contains the Casper Network implementation of the Mogate RWA platform with NFT faucet, burn validation, and authority mint contracts.

## Network Branches

This is a multi-chain project. Each blockchain has its own branch:

- **`main` / `solana`** — Solana implementation
- **`casper-network`** — Casper Network implementation ⭐ **YOU ARE HERE**
- **`evm`** — EVM implementation _(coming soon)_

**Switch branches to view network-specific code and documentation.**

---

## Casper Network Implementation

### Tech Stack

- **Native Casper Contracts** (Rust with `casper-contract` + `casper-types`)
- **CEP-78 Enhanced NFT Standard** for collections
- **CEP-18 Token Standard** for MOGA token
- **TypeScript SDK** with `casper-js-sdk`

### Project Structure

```
contracts/
├── +casper_authority_mint/     # Authority mint contract (native Casper)
├── $moga-collection/           # CEP-78 NFT collections
│   ├── cep78.wasm             # Pre-compiled CEP-78 binary
│   ├── deploy-tixia-1o1.sh    # Deploy Tixia 1/1 collection
│   └── deploy-tixia-sft.sh    # Deploy Tixia SFT collection
└── +odra_authority_mint/       # Odra skeleton (not used)

ts-sdk/
├── src/casper-authority-mint.ts         # Authority mint SDK
└── src/casper-authority-mint.example.ts # Usage examples

offchain/backend/
├── src/casper-nft-validator.ts          # Burn validation service
├── src/api-burn-validator.ts            # REST API endpoints
└── README-BURN-VALIDATOR.md             # Burn validator docs

scripts/casper/
├── mint-nft.ts           # Mint NFT via authority mint
└── validate-burn.ts      # Validate burn transaction

docs/casper/
├── CEP78_COLLECTIONS_DEPLOYED.md        # Collection deployment guide
├── AUTHORITY_MINT_DEPLOYED.md           # Authority mint guide
└── FINAL_STATUS.md                      # Deployment summary
```

### Deployed Contracts (Testnet)

| Contract                 | Hash                                                               | Explorer                                                                                                    |
| ------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Authority Mint**       | `b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc` | [View](https://testnet.cspr.live/contract/b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc) |
| **Tixia 1/1 Collection** | `376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97` | [View](https://testnet.cspr.live/contract/376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97) |
| **Tixia SFT Collection** | `e3699ea7bbbcc74018b0c24d3557c6cfd34b9c30405cf4cf4bae3dfc589ccea0` | [View](https://testnet.cspr.live/contract/e3699ea7bbbcc74018b0c24d3557c6cfd34b9c30405cf4cf4bae3dfc589ccea0) |

### Key Features

✅ **CEP-78 NFT Collections** - Standard-compliant NFTs with metadata  
✅ **Authority Mint Contract** - Delegated minting for simplified frontend  
✅ **Burn Validation** - Extract metadata + owner from burn tx hash  
✅ **TypeScript SDK** - Full SDK for minting and validation  
✅ **REST API** - Backend endpoints for burn validation

---

## Prerequisites

- **Rust** nightly-2025-02-04 (for contract builds)
- **Bun** 1.0+ (package manager)
- **casper-client** 5.0.0+ (`cargo install casper-client`)
- **Casper testnet account** with CSPR tokens

---

## Quick Start

### 1. Install Dependencies

```bash
bun install
cd ts-sdk && bun install
cd ../offchain/backend && bun install
```

### 2. Build Authority Mint Contract

```bash
bun run casper:build-authority-mint
```

### 3. Deploy Authority Mint

```bash
bun run casper:deploy-authority-mint
```

### 4. Allow Collections

```bash
bun run casper:allow-collections
```

### 5. Mint NFT

```bash
bun run casper:mint-nft [RECIPIENT_ACCOUNT_HASH]
```

### 6. Validate Burn

```bash
bun run casper:validate-burn <BURN_TX_HASH>
```

---

## Available Scripts

| Script                         | Description                        |
| ------------------------------ | ---------------------------------- |
| `casper:build-authority-mint`  | Build authority mint WASM          |
| `casper:deploy-authority-mint` | Deploy authority mint contract     |
| `casper:allow-collections`     | Whitelist collections              |
| `casper:deploy-collection-1o1` | Deploy Tixia 1/1 collection        |
| `casper:deploy-collection-sft` | Deploy Tixia SFT collection        |
| `casper:mint-nft`              | Mint NFT via TypeScript            |
| `casper:validate-burn`         | Validate burn tx + extract data    |
| `casper:deploy-all`            | Build + deploy + allow collections |

---

## Development Notes

### Contract Development

- **Native Casper contracts** use `casper-contract` + `casper-types` crates
- **CEP-78 collections** deployed from official reference implementation
- **Authority mint** delegates minting to CEP-78 collections
- **No Odra** - Native contracts are more stable and battle-tested

### Building Contracts

```bash
cd contracts/+casper_authority_mint
RUSTFLAGS='-C target-cpu=mvp' cargo +nightly-2025-02-04 build \
  --release --target wasm32-unknown-unknown \
  -Z build-std=std,panic_abort
```

### Deployment

```bash
# Deploy collection
cd contracts/$moga-collection
./deploy-tixia-1o1.sh

# Deploy authority mint
cd contracts/+casper_authority_mint
./deploy-authority-mint.sh

# Allow collections
./allow-collections.sh
```

---

## Documentation

### Casper-Specific Docs

- **[CEP78 Collections Deployed](docs/casper/CEP78_COLLECTIONS_DEPLOYED.md)** - Collection deployment guide
- **[Authority Mint Deployed](docs/casper/AUTHORITY_MINT_DEPLOYED.md)** - Authority mint guide
- **[Burn Validator](offchain/backend/README-BURN-VALIDATOR.md)** - Burn validation system
- **[Casper SDK](ts-sdk/README-CASPER.md)** - TypeScript SDK documentation

### API Documentation

- **Mint NFT**: `POST /api/casper/mint`
- **Validate Burn**: `POST /api/casper/validate-burn`
- **Batch Validate**: `POST /api/casper/validate-burns`
- **Get Burn Details**: `GET /api/casper/burn/:hash`

---

## Architecture

```
Frontend/Backend
      |
      | calls mint_nft()
      v
Authority Mint Contract
      |
      | verifies collection allowed
      | calls CEP-78 mint()
      v
CEP-78 Collection (Tixia 1/1 or SFT)
      |
      | mints NFT
      v
Recipient Account
```

### Burn Validation Flow

```
User burns NFT
      |
      | burn tx hash
      v
Burn Validator
      |
      | fetches deploy
      | parses events
      | queries contract state
      v
Returns: metadata URI + last owner
```

---

## Network Configuration

- **RPC Node**: `http://65.109.83.79:7777`
- **Chain Name**: `casper-test`
- **Explorer**: https://testnet.cspr.live

---

## Status

✅ **Authority Mint** - Deployed and functional  
✅ **CEP-78 Collections** - Deployed (Tixia 1/1 + SFT)  
✅ **TypeScript SDK** - Complete with examples  
✅ **Burn Validator** - Fully functional  
✅ **REST API** - Backend endpoints ready  
🚀 **Production Ready** - All contracts tested on testnet

---

## License

Apache-2.0
