# Offchain Services - Complete Overview

## 🎯 Purpose

The offchain package provides modular, reusable services for the RWA Raffle system:

- **EIP-712 permit signing** for gasless raffle operations
- **API server** for backend permit generation
- **CLI scripts** for testing and development
- **Reusable utilities** for ts-sdk and other packages

## 📁 Directory Structure

### `/src/core/` - Core Utilities (Reusable)

**Purpose**: Shared utilities that can be imported by ts-sdk, scripts, and services.

| File         | Purpose                      | Exports                                                                                                                   |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `env.ts`     | Environment variable helpers | `getRequiredEnv`, `getBooleanEnv`, `getBigIntEnv`, `getNumberEnv`, `getEnv`                                               |
| `network.ts` | Network configuration        | `resolveNetworkTarget`, `resolveRpcUrl`, `resolveRaffleAddress`, `resolveCollectionAddress`, `resolveChainId`             |
| `crypto.ts`  | Cryptographic utilities      | `resolvePrivateKey`, `resolveAddressFromEnvOrPk`                                                                          |
| `file.ts`    | File operations              | `writeJson`, `readJson`, `resolveOutputPath`                                                                              |
| `parsers.ts` | Input parsing/validation     | `parseBigIntLike`, `parseBooleanLike`, `parseNumberLike`, `parseString`, `parseAddress`, `parseSlotIds`, `resolveSlotIds` |
| `index.ts`   | Barrel export                | All of the above                                                                                                          |

### `/src/services/` - Business Logic

**Purpose**: High-level services for permit operations.

| File        | Purpose                | Exports                                                                           |
| ----------- | ---------------------- | --------------------------------------------------------------------------------- |
| `permit.ts` | Permit signing service | `signHostPermit`, `signJoinPermit`, `signHostAndJoinPermit`, `resolveDomainInput` |
| `index.ts`  | Barrel export          | All of the above                                                                  |

### `/src/api/` - API Server

**Purpose**: Bun native HTTP server for permit signing.

| File        | Purpose         | Exports                                                                                                           |
| ----------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `utils.ts`  | API utilities   | `withCors`, `jsonResponse`, `requireApiKey`, `hostMessageToJson`, `joinMessageToJson`, `hostAndJoinMessageToJson` |
| `server.ts` | Bun HTTP server | Default export (server instance)                                                                                  |

### `/scripts/` - Executable Scripts

**Purpose**: CLI tools for signing and submitting permits.

| File                    | Purpose            | Command               |
| ----------------------- | ------------------ | --------------------- |
| `sign-host-permit.ts`   | Sign host permit   | `bun run sign:host`   |
| `sign-join-permit.ts`   | Sign join permit   | `bun run sign:join`   |
| `submit-host-permit.ts` | Submit host permit | `bun run submit:host` |
| `submit-join-permit.ts` | Submit join permit | `bun run submit:join` |

## 🔧 Technology Stack

### Runtime

- **Bun** - Fast JavaScript runtime with native TypeScript support

### Dependencies

- **ethers** (v6.16.0) - Ethereum library for signing and transactions
- **dotenv** (v16.4.5) - Environment variable management

### Dev Dependencies

- **@types/node** - Node.js type definitions
- **bun-types** - Bun type definitions

### Why Bun Native Server?

- ✅ **Faster** than Express (3x-4x in benchmarks)
- ✅ **Less dependencies** (no express, cors, body-parser)
- ✅ **Native TypeScript** support
- ✅ **Built-in** request/response handling
- ✅ **Smaller bundle** size

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Server

```bash
bun run server
```

### 4. Test API

```bash
curl http://127.0.0.1:3011/health
```

## 📡 API Endpoints

### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "service": "evm-permit-server",
  "backendSigner": "0x..."
}
```

### `POST /evm/permit/host`

Sign a host raffle permit.

**Request:**

```json
{
  "chainId": "11155111",
  "raffleAddress": "0x...",
  "organizer": "0x...",
  "totalSlots": "10",
  "maxSlotsPerAddress": "3",
  "metadataUri": "https://...",
  "collection": "0x...",
  "prizeType": 1,
  "prizeAmount": "1",
  "autoDraw": true,
  "expiresAt": "1772285000"
}
```

**Response:**

```json
{
  "domain": { ... },
  "message": { ... },
  "signature": "0x...",
  "digest": "0x...",
  "backendSigner": "0x...",
  "createdAt": "2026-03-01T..."
}
```

### `POST /evm/permit/join`

Sign a join raffle permit.

**Request:**

```json
{
  "chainId": "11155111",
  "raffleAddress": "0x...",
  "raffleId": "raffle-123",
  "slotIds": ["1", "2"],
  "amount": "20000000000000000",
  "token": "0x0000000000000000000000000000000000000000",
  "payer": "0x..."
}
```

### `POST /evm/permit/host-and-join`

Sign a combined host-and-join permit.

## 🔐 Environment Variables

### Required

- `BACKEND_SIGNER_PRIVATE_KEY` - Backend signer private key

### Network Configuration

- `TARGET_NETWORK` - Network: `sepolia`, `arbitrumSepolia`, `polygonAmoy` (default: `sepolia`)
- `RAFFLE_ADDRESS` - Raffle contract address
- `COLLECTION_ADDRESS` - Collection address
- `CHAIN_ID` - Chain ID (optional)
- `RPC_URL` - RPC URL (optional)

### Server Configuration

- `EVM_PERMIT_SERVER_PORT` - Port (default: `3011`)
- `EVM_PERMIT_SERVER_HOST` - Host (default: `127.0.0.1`)
- `EVM_PERMIT_SERVER_API_KEY` - API key (optional)

### Script Configuration

- `ORGANIZER_PRIVATE_KEY` - For submit-host-permit
- `PAYER_PRIVATE_KEY` - For submit-join-permit
- `RAFFLE_ID` - Raffle ID for join permits
- `JOIN_SLOT_IDS` - Comma-separated slot IDs
- `JOIN_AMOUNT_ETH` - Amount in ETH
- `DRY_RUN` - Set to `true` for dry run

## 🔄 Reusability in TS-SDK

### Import Core Utilities

```typescript
import {
  resolveNetworkTarget,
  resolveRaffleAddress,
  parseAddress,
  parseBigIntLike,
} from "@moga/rwa-raffle-offchain/src/core";
```

### Import Services

```typescript
import {
  signHostPermit,
  signJoinPermit,
} from "@moga/rwa-raffle-offchain/src/services";
```

### Import API Utilities

```typescript
import {
  withCors,
  jsonResponse,
} from "@moga/rwa-raffle-offchain/src/api/utils";
```

## 📝 CLI Usage Examples

### Sign Host Permit

```bash
# Basic
bun run sign:host

# With custom configuration
RAFFLE_ID=my-raffle \
RAFFLE_TOTAL_SLOTS=100 \
RAFFLE_MAX_SLOTS_PER_ADDRESS=5 \
bun run sign:host
```

### Sign Join Permit

```bash
# Basic
RAFFLE_ID=my-raffle \
JOIN_SLOT_IDS=1,2,3 \
JOIN_AMOUNT_ETH=0.05 \
bun run sign:join
```

### Submit Permits

```bash
# Dry run (verify only)
DRY_RUN=true bun run submit:host
DRY_RUN=true bun run submit:join

# Submit transaction
bun run submit:host
bun run submit:join
```

## 🧪 Testing

### Test Server

```bash
# Start server
bun run server

# In another terminal
curl http://127.0.0.1:3011/health
```

### Test Permit Signing

```bash
# Sign host permit
bun run sign:host

# Check output
cat out/host-permit.json
```

### Test Permit Submission

```bash
# Dry run
DRY_RUN=true bun run submit:host

# Real submission
bun run submit:host
```

## 📚 Documentation Files

- **README.md** - Main documentation
- **OVERVIEW.md** - This file (complete overview)
- **MIGRATION.md** - Migration guide from old structure
- **TS_SDK_INTEGRATION.md** - Integration examples for ts-sdk
- **REORGANIZATION_SUMMARY.md** - Summary of reorganization changes

## 🎨 Design Principles

1. **Modularity** - Each module has a single responsibility
2. **Reusability** - Core utilities can be imported anywhere
3. **Type Safety** - Full TypeScript support
4. **Performance** - Bun native server for speed
5. **Simplicity** - Clean dependencies, no bloat
6. **Consistency** - Same validation logic everywhere

## 🔮 Future Enhancements

- [ ] Add database integration for permit storage
- [ ] Add rate limiting middleware
- [ ] Add permit caching
- [ ] Add webhook notifications
- [ ] Add permit expiration tracking
- [ ] Add analytics/metrics
- [ ] Add comprehensive test suite

## 🤝 Contributing

When adding new features:

1. Keep utilities in `src/core/` if they're reusable
2. Keep business logic in `src/services/`
3. Keep API-specific code in `src/api/`
4. Update barrel exports in `index.ts` files
5. Add documentation to README.md

## 📄 License

Part of the RWA Raffle monorepo.
