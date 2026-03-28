# Offchain Services

Modular offchain services for the RWA Raffle system, including:

- **API Server**: Bun-native HTTP server for EIP-712 permit signing
- **Core Utilities**: Reusable modules for environment, network, crypto, and parsing
- **Services**: Business logic for permit generation and validation
- **Scripts**: Executable scripts for signing and submitting permits

## Project Structure

```
offchain/
├── src/
│   ├── core/           # Core utilities (reusable across scripts and SDK)
│   │   ├── env.ts      # Environment variable utilities
│   │   ├── network.ts  # Network configuration
│   │   ├── crypto.ts   # Cryptographic utilities
│   │   ├── file.ts     # File system utilities
│   │   ├── parsers.ts  # Input parsing utilities
│   │   └── index.ts    # Barrel export
│   ├── services/       # Business logic services
│   │   ├── permit.ts   # Permit signing service
│   │   └── index.ts    # Barrel export
│   └── api/            # API server
│       ├── utils.ts    # API utilities
│       └── server.ts   # Bun HTTP server
└── out/                # Output directory for generated permits
```

## Features

### ✅ Modular Architecture

- **Core utilities** are reusable across scripts, services, and the ts-sdk
- **Services** encapsulate business logic for permit operations
- **API** uses Bun's native HTTP server (no Express needed)

### ✅ Clean Dependencies

- Only essential dependencies: `ethers` and `dotenv`
- No Solana dependencies (EVM-focused)
- No Express (Bun native server)

## Environment Variables

### Common

- `TARGET_NETWORK` - Network target: `sepolia`, `arbitrumSepolia`, or `polygonAmoy` (default: `sepolia`)
- `RAFFLE_ADDRESS` - Raffle contract address (or network-specific `RAFFLE_ADDRESS_*`)
- `COLLECTION_ADDRESS` - Collection address (or network-specific `COLLECTION_ADDRESS_*`)
- `CHAIN_ID` - Chain ID (optional, avoids RPC lookup)
- `RPC_URL` - RPC URL (or network-specific RPC var)

### Backend Signing

- `BACKEND_SIGNER_PRIVATE_KEY` - Backend signer private key

### Frontend Submit

- `ORGANIZER_PRIVATE_KEY` - Organizer private key for host submit
- `PAYER_PRIVATE_KEY` - Payer private key for join submit

### Server Configuration

- `EVM_PERMIT_SERVER_PORT` - Server port (default: `3011`)
- `EVM_PERMIT_SERVER_HOST` - Server host (default: `127.0.0.1`)
- `EVM_PERMIT_SERVER_API_KEY` - API key for authentication (optional)

## Usage

### Start API Server

```bash
bun run server
# or
bun run dev
```

Server runs on `http://127.0.0.1:3011` by default.

**Endpoints:**

- `GET /health` - Health check
- `POST /evm/permit/host` - Sign host permit
- `POST /evm/permit/join` - Sign join permit
- `POST /evm/permit/host-and-join` - Sign host-and-join permit

### Use Permit Services

The offchain package provides reusable services for permit signing. See the root `/scripts/permits/` directory for usage examples.

## API Examples

### Health Check

```bash
curl http://127.0.0.1:3011/health
```

### Sign Host Permit

```bash
curl -X POST http://127.0.0.1:3011/evm/permit/host \
  -H "content-type: application/json" \
  -d '{
    "chainId": "11155111",
    "raffleAddress": "0x1111111111111111111111111111111111111111",
    "organizer": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "raffleId": "safe-host-api-1",
    "totalSlots": "10",
    "maxSlotsPerAddress": "3",
    "metadataUri": "https://example.com/raffle.json",
    "collection": "0x0000000000000000000000000000000000000000",
    "prizeType": 1,
    "prizeAmount": "1",
    "autoDraw": true,
    "expiresAt": "1772285000"
  }'
```

### Sign Join Permit

```bash
curl -X POST http://127.0.0.1:3011/evm/permit/join \
  -H "content-type: application/json" \
  -d '{
    "chainId": "11155111",
    "raffleAddress": "0x1111111111111111111111111111111111111111",
    "raffleId": "safe-host-api-1",
    "slotIds": ["1","2"],
    "amount": "20000000000000000",
    "token": "0x0000000000000000000000000000000000000000",
    "payer": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }'
```

## Reusability

The modular structure allows easy reuse:

```typescript
// In your ts-sdk or other scripts
import {
  resolveNetworkTarget,
  resolveRaffleAddress,
  parseAddress,
  parseBigIntLike,
} from "@moga/rwa-raffle-offchain/src/core";

import { signHostPermit } from "@moga/rwa-raffle-offchain/src/services";
```

## Development

Install dependencies:

```bash
bun install
```

Run server in development:

```bash
bun run dev
```

The server uses Bun's native HTTP capabilities for optimal performance.
