# TS-SDK Quick Reference

## 🎯 Find Functions Fast

### Need to create a signer?

→ `signer.ts`

```typescript
import { createSignerFromPrivateKey } from "./signer.ts";
const signer = createSignerFromPrivateKey(privateKey);
```

### Need to create a client?

→ `client-factory.ts`

```typescript
import { createRaffleClient } from "./client-factory.ts";
const client = createRaffleClient({ rpcUrl, privateKey, raffleAddress });
```

### Need to sign a permit?

→ `permits.ts`

```typescript
import { signHostRafflePermit, buildRaffleDomain } from "./permits.ts";
const domain = buildRaffleDomain(chainId, raffleAddress);
const signature = await signHostRafflePermit(signer, domain, params);
```

### Need to execute a transaction?

→ `transactions.ts`

```typescript
import { hostRaffleWithPermit } from "./transactions.ts";
const report = await hostRaffleWithPermit(client, params, signature);
```

### Need type definitions?

→ `types.ts`

```typescript
import type { HostRafflePermit, PrizeTokenType } from "./types.ts";
```

### Need EIP-712 constants?

→ `constants.ts`

```typescript
import { HOST_RAFFLE_TYPES, RAFFLE_EIP712_DOMAIN } from "./constants.ts";
```

## 📋 Function Lookup Table

| What do you want to do?        | File                | Function                           |
| ------------------------------ | ------------------- | ---------------------------------- |
| Create signer from private key | `signer.ts`         | `createSignerFromPrivateKey()`     |
| Create signer with RPC         | `signer.ts`         | `createSignerFromRpc()`            |
| Get signer address             | `signer.ts`         | `getSignerAddress()`               |
| Create provider                | `signer.ts`         | `createProvider()`                 |
| Create client from RPC         | `client-factory.ts` | `createRaffleClient()`             |
| Create client from signer      | `client-factory.ts` | `createRaffleClientFromSigner()`   |
| Create read-only client        | `client-factory.ts` | `createRaffleClientFromProvider()` |
| Build EIP-712 domain           | `permits.ts`        | `buildRaffleDomain()`              |
| Sign host permit               | `permits.ts`        | `signHostRafflePermit()`           |
| Sign join permit               | `permits.ts`        | `signJoinRafflePermit()`           |
| Hash host permit               | `permits.ts`        | `hashHostRafflePermit()`           |
| Hash join permit               | `permits.ts`        | `hashJoinRafflePermit()`           |
| Verify permit signature        | `permits.ts`        | `verifyHostRafflePermit()`         |
| Host raffle with permit        | `transactions.ts`   | `hostRaffleWithPermit()`           |
| Join raffle with permit        | `transactions.ts`   | `joinRaffleWithPermit()`           |
| Host raffle without permit     | `transactions.ts`   | `unsafeHostRaffleWithReport()`     |
| Join raffle without permit     | `transactions.ts`   | `unsafeJoinRaffleWithReport()`     |
| Parse raffle load detail       | `utils.ts`          | `parseRaffleLoadDetail()`          |
| Parse raffle result            | `utils.ts`          | `parseRaffleResult()`              |
| Get raffle bytes ID            | `utils.ts`          | `getRaffleBytesId()`               |

## 🔍 Common Workflows

### Workflow 1: Create and Sign a Host Permit

```typescript
// 1. Import what you need
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signHostRafflePermit,
  PrizeTokenType,
} from "./index.ts";

// 2. Create signer
const signer = createSignerFromPrivateKey(process.env.PRIVATE_KEY!);

// 3. Build domain
const domain = buildRaffleDomain(
  BigInt(11155111), // Sepolia
  "0x...", // Raffle address
);

// 4. Prepare params
const params = {
  raffleId: "my-raffle",
  totalSlots: 100n,
  maxSlotsPerAddress: 5n,
  metadataUri: "https://...",
  collection: "0x...",
  premintContract: false,
  premint: false,
  prizeType: PrizeTokenType.ERC721,
  prizeAmount: 1n,
  autoDraw: true,
  autoClaim: false,
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
  organizer: "0x...",
};

// 5. Sign
const signature = await signHostRafflePermit(signer, domain, params);
```

### Workflow 2: Execute a Transaction

```typescript
// 1. Import what you need
import { createRaffleClient, hostRaffleWithPermit } from "./index.ts";

// 2. Create client
const client = createRaffleClient({
  rpcUrl: "https://sepolia.infura.io/v3/...",
  privateKey: process.env.ORGANIZER_PRIVATE_KEY,
  raffleAddress: "0x...",
});

// 3. Execute transaction
const report = await hostRaffleWithPermit(client, params, signature);

// 4. Check result
console.log("Transaction hash:", report.txHash);
console.log("Raffle ID:", report.raffleId);
console.log("Status:", report.load.statusString);
```

### Workflow 3: Verify a Permit

```typescript
// 1. Import what you need
import { buildRaffleDomain, verifyHostRafflePermit } from "./index.ts";

// 2. Build domain
const domain = buildRaffleDomain(chainId, raffleAddress);

// 3. Verify signature
const recoveredAddress = verifyHostRafflePermit(domain, params, signature);

// 4. Check if it matches expected signer
if (recoveredAddress.toLowerCase() === expectedSigner.toLowerCase()) {
  console.log("✅ Signature valid!");
} else {
  console.log("❌ Signature invalid!");
}
```

## 📦 Import Patterns

### Pattern 1: Specific Imports (Recommended)

```typescript
import { createSignerFromPrivateKey } from "./signer.ts";
import { signHostRafflePermit } from "./permits.ts";
import { hostRaffleWithPermit } from "./transactions.ts";
```

**Benefits:**

- Clear where each function comes from
- Easy to navigate to source
- Better for code review

### Pattern 2: Barrel Import

```typescript
import {
  createSignerFromPrivateKey,
  signHostRafflePermit,
  hostRaffleWithPermit,
} from "./index.ts";
```

**Benefits:**

- Shorter import statements
- All from one place
- Good for external packages

### Pattern 3: Namespace Import

```typescript
import * as RaffleSDK from "./index.ts";

const signer = RaffleSDK.createSignerFromPrivateKey(privateKey);
const signature = await RaffleSDK.signHostRafflePermit(signer, domain, params);
```

**Benefits:**

- Clear namespace
- Avoid naming conflicts
- Good for large projects

## 🎨 Type Imports

```typescript
// Import types
import type {
  HostRafflePermit,
  JoinRafflePermit,
  RaffleClient,
  TransactionReport,
  PrizeTokenType,
} from "./types.ts";

// Or from index
import type { HostRafflePermit, RaffleClient } from "./index.ts";
```

## 🚀 Quick Start Template

```typescript
import * as dotenv from "dotenv";
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signHostRafflePermit,
  PrizeTokenType,
  type HostRafflePermit,
} from "../../ts-sdk/src/evm/index.ts";

dotenv.config();

async function main() {
  // Configuration
  const PRIVATE_KEY = process.env.PRIVATE_KEY!;
  const CHAIN_ID = BigInt(11155111);
  const RAFFLE_ADDRESS = process.env.RAFFLE_ADDRESS!;

  // Create signer
  const signer = createSignerFromPrivateKey(PRIVATE_KEY);

  // Build domain
  const domain = buildRaffleDomain(CHAIN_ID, RAFFLE_ADDRESS);

  // Prepare params
  const params: HostRafflePermit = {
    raffleId: `raffle-${Date.now()}`,
    totalSlots: 100n,
    maxSlotsPerAddress: 5n,
    metadataUri: "https://example.com/metadata.json",
    collection: "0x0000000000000000000000000000000000000000",
    premintContract: false,
    premint: false,
    prizeType: PrizeTokenType.ERC721,
    prizeAmount: 1n,
    autoDraw: true,
    autoClaim: false,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 86400),
    organizer: await signer.getAddress(),
  };

  // Sign permit
  const signature = await signHostRafflePermit(signer, domain, params);

  console.log("✅ Signature:", signature);
}

main().catch(console.error);
```

## 📚 See Also

- [README.md](./src/evm/README.md) - Detailed documentation
- [MODULARIZATION.md](./MODULARIZATION.md) - Migration guide
- [Example Scripts](../scripts/permits/) - Working examples
