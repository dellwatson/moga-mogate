# Migration Guide

## What Changed

The offchain directory has been reorganized for better modularity and reusability.

### Old Structure

```
offchain/
├── server.ts
├── worker.ts
├── shared.ts
├── organizer_db.ts
├── sign-host-permit.ts
├── sign-join-permit.ts
├── submit-host-permit.ts
├── submit-join-permit.ts
└── package.json (with Express, Solana deps)
```

### New Structure

```
offchain/
├── src/
│   ├── core/          # Reusable utilities
│   ├── services/      # Business logic
│   └── api/           # Bun native server
├── scripts/           # Executable scripts
└── package.json       # Clean dependencies
```

## Key Changes

### 1. Removed Dependencies

- ❌ `express` - Replaced with Bun native server
- ❌ `cors` - Built into Bun server utilities
- ❌ `@solana/web3.js` - Not needed for EVM-focused project
- ❌ `@coral-xyz/anchor` - Not needed for EVM-focused project
- ✅ Kept: `ethers`, `dotenv`

### 2. Modular Core Utilities

All utilities from `shared.ts` have been split into focused modules:

- `src/core/env.ts` - Environment variables
- `src/core/network.ts` - Network configuration
- `src/core/crypto.ts` - Cryptographic utilities
- `src/core/file.ts` - File operations
- `src/core/parsers.ts` - Input parsing

### 3. Service Layer

Business logic extracted to `src/services/permit.ts`:

- `signHostPermit()`
- `signJoinPermit()`
- `signHostAndJoinPermit()`

### 4. Scripts Location

Scripts are located in the root `/scripts/` directory, not within the offchain package. The offchain package provides reusable services that scripts can import.

### 5. Bun Native Server

`server.ts` → `src/api/server.ts` using Bun.serve() instead of Express.

## Migration Steps

### For Scripts

**Old:**

```typescript
import { resolveNetworkTarget } from "./shared.ts";
```

**New:**

```typescript
import { resolveNetworkTarget } from "../src/core/index.ts";
```

### For API Usage

**Old:**

```bash
bun run evm:permit:server
```

**New:**

```bash
bun run server
# or
bun run dev
```

### For Permit Signing

Use the root `/scripts/permits/` examples or import the services directly:

```typescript
import { signHostPermit } from "@moga/rwa-raffle-offchain/src/services";
```

## Files to Remove (Old Structure)

After verifying the new structure works:

- `server.ts` (replaced by `src/api/server.ts`)
- `shared.ts` (split into `src/core/*`)
- `worker.ts` (Solana-specific, not needed for EVM)
- `organizer_db.ts` (Solana-specific, not needed for EVM)
- `permit_example.ts` (replaced by root `/scripts/permits/` examples)
- Old root-level script files (if any)

## Benefits

1. **Modularity**: Core utilities can be imported by ts-sdk and other packages
2. **Clean Dependencies**: Only what's needed for EVM operations
3. **Better Performance**: Bun native server is faster than Express
4. **Type Safety**: Better organized types and interfaces
5. **Maintainability**: Clear separation of concerns
