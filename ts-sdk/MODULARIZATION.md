# TS-SDK Modularization Guide

## What Changed

The `ts-sdk/src/evm/client.ts` file (652 lines) has been split into focused, modular files.

### Before

```
ts-sdk/src/evm/
├── abi.ts (1929 bytes)
├── client.ts (17027 bytes) ← 652 lines, everything in one file
└── index.ts
```

### After

```
ts-sdk/src/evm/
├── types.ts              # Type definitions (150 lines)
├── constants.ts          # EIP-712 constants (60 lines)
├── abi.ts               # Contract ABI (unchanged)
├── client-factory.ts    # Client creation (60 lines)
├── signer.ts            # Signer utilities (60 lines)
├── permits.ts           # Permit operations (160 lines)
├── transactions.ts      # Transaction functions (250 lines)
├── utils.ts             # Utility functions (50 lines)
├── client.ts            # Legacy (backward compatibility)
├── index.ts             # Barrel export
└── README.md            # Documentation
```

## Key Improvements

### 1. Easy to Find Functions

**Before:**

```typescript
// Had to scroll through 652 lines to find signHostRafflePermit
```

**After:**

```typescript
// Clear file organization
import { signHostRafflePermit } from "./permits.ts"; // Line 77
import { createRaffleClient } from "./client-factory.ts"; // Line 28
import { createSignerFromPrivateKey } from "./signer.ts"; // Line 14
```

### 2. Smaller, Focused Files

| File                | Purpose           | Lines |
| ------------------- | ----------------- | ----- |
| `types.ts`          | Type definitions  | ~150  |
| `constants.ts`      | EIP-712 constants | ~60   |
| `client-factory.ts` | Client creation   | ~60   |
| `signer.ts`         | Signer utilities  | ~60   |
| `permits.ts`        | Permit operations | ~160  |
| `transactions.ts`   | Transactions      | ~250  |
| `utils.ts`          | Utilities         | ~50   |

### 3. Better Imports

**Before:**

```typescript
import {
  createRaffleClient,
  signHostRafflePermit,
  hostRaffleWithPermit,
  PrizeTokenType,
  // ... everything from one huge file
} from "./client.ts";
```

**After:**

```typescript
// Import only what you need from specific modules
import { createRaffleClient } from "./client-factory.ts";
import { signHostRafflePermit } from "./permits.ts";
import { hostRaffleWithPermit } from "./transactions.ts";
import { PrizeTokenType } from "./types.ts";

// Or import from index (barrel export)
import {
  createRaffleClient,
  signHostRafflePermit,
  hostRaffleWithPermit,
  PrizeTokenType,
} from "./index.ts";
```

## Migration Guide

### No Breaking Changes!

All existing code continues to work:

```typescript
// Old code still works
import { createRaffleClient, signHostRafflePermit } from "./client.ts";

// New code (recommended)
import { createRaffleClient } from "./client-factory.ts";
import { signHostRafflePermit } from "./permits.ts";
```

### Recommended Updates

#### 1. Update Imports for Clarity

**Before:**

```typescript
import {
  createRaffleClient,
  signHostRafflePermit,
  hostRaffleWithPermit,
} from "../../ts-sdk/src/evm/client.ts";
```

**After:**

```typescript
import { createRaffleClient } from "../../ts-sdk/src/evm/client-factory.ts";
import { signHostRafflePermit } from "../../ts-sdk/src/evm/permits.ts";
import { hostRaffleWithPermit } from "../../ts-sdk/src/evm/transactions.ts";

// Or use barrel export
import {
  createRaffleClient,
  signHostRafflePermit,
  hostRaffleWithPermit,
} from "../../ts-sdk/src/evm/index.ts";
```

#### 2. Use Signer Utilities

**Before:**

```typescript
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(rpcUrl);
const signer = new ethers.Wallet(privateKey, provider);
```

**After:**

```typescript
import { createSignerFromRpc } from "../../ts-sdk/src/evm/signer.ts";

const signer = createSignerFromRpc(privateKey, rpcUrl);
```

## File Reference

### `types.ts` - Type Definitions

All TypeScript types and interfaces:

- `PrizeTokenType` enum
- `RaffleClient`, `RaffleClientConfig`
- `HostRafflePermit`, `JoinRafflePermit`
- `TransactionReport`, `RaffleLoadReport`

### `constants.ts` - EIP-712 Constants

EIP-712 domain and type definitions:

- `RAFFLE_EIP712_DOMAIN`
- `HOST_RAFFLE_TYPES`
- `JOIN_RAFFLE_TYPES`
- `HOST_AND_JOIN_RAFFLE_TYPES`

### `client-factory.ts` - Client Creation

Functions to create `RaffleClient` instances:

- `createRaffleClient()` - From RPC URL + private key
- `createRaffleClientFromSigner()` - From existing signer
- `createRaffleClientFromProvider()` - Read-only client
- `getRaffleContract()` - Get contract instance

### `signer.ts` - Signer Utilities

Helper functions for signers:

- `createSignerFromPrivateKey()` - Create signer
- `createSignerFromRpc()` - Create signer with provider
- `getSignerAddress()` - Get address
- `createProvider()` - Create provider
- `getNetworkInfo()` - Get network info

### `permits.ts` - Permit Operations

EIP-712 permit signing and verification:

- `buildRaffleDomain()` - Build domain
- `signHostRafflePermit()` - Sign host permit
- `signJoinRafflePermit()` - Sign join permit
- `hashHostRafflePermit()` - Hash permit
- `verifyHostRafflePermit()` - Verify signature

### `transactions.ts` - Transaction Functions

Execute raffle transactions:

- `hostRaffleWithPermit()` - Host with permit
- `joinRaffleWithPermit()` - Join with permit
- `unsafeHostRaffleWithReport()` - Host without permit
- `unsafeJoinRaffleWithReport()` - Join without permit

### `utils.ts` - Utility Functions

Helper functions:

- `parseRaffleLoadDetail()` - Parse load detail
- `parseRaffleResult()` - Parse result
- `getRaffleBytesId()` - Generate bytes32 ID

## Example: Reusable Permit Creation

### In Scripts (`scripts/permits/create-host-permit.ts`)

```typescript
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signHostRafflePermit,
  PrizeTokenType,
} from "../../ts-sdk/src/evm/index.ts";

// Create signer (reusable utility)
const signer = createSignerFromPrivateKey(process.env.PRIVATE_KEY!);

// Build domain (reusable utility)
const domain = buildRaffleDomain(chainId, raffleAddress);

// Sign permit (reusable utility)
const signature = await signHostRafflePermit(signer, domain, params);
```

### In Offchain Service (`offchain/src/services/permit.ts`)

```typescript
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signHostRafflePermit,
} from "@moga/rwa-raffle-ts-sdk/src/evm";

export async function createHostPermit(config) {
  // Reuse the same utilities!
  const signer = createSignerFromPrivateKey(config.privateKey);
  const domain = buildRaffleDomain(config.chainId, config.raffleAddress);
  return signHostRafflePermit(signer, domain, config.params);
}
```

## Benefits

### 1. DRY (Don't Repeat Yourself)

- ✅ Utilities are defined once in ts-sdk
- ✅ Reused in scripts, offchain service, and frontend
- ✅ No code duplication

### 2. Easy to Navigate

- ✅ Find functions quickly by file name
- ✅ Each file has a single responsibility
- ✅ Clear organization

### 3. Better Maintainability

- ✅ Smaller files are easier to understand
- ✅ Changes are isolated to specific modules
- ✅ Easier to test individual components

### 4. Type Safety

- ✅ Centralized type definitions
- ✅ Consistent types across all modules
- ✅ Better IDE autocomplete

### 5. Tree-Shaking

- ✅ Import only what you need
- ✅ Smaller bundle sizes
- ✅ Better performance

## Next Steps

1. ✅ **Modularization Complete** - All files created
2. ✅ **Backward Compatible** - Old code still works
3. ✅ **Example Scripts** - Created in `scripts/permits/`
4. ✅ **Documentation** - Added README.md
5. 🔄 **Update Offchain Service** - Use ts-sdk utilities (optional)
6. 🔄 **Update Frontend** - Use ts-sdk utilities (optional)

## Questions?

See the [README.md](./src/evm/README.md) for detailed usage examples and API reference.
