# EVM Raffle SDK - Modular Structure

The EVM SDK has been reorganized into modular components for better maintainability and reusability.

## 📁 File Structure

```
ts-sdk/src/evm/
├── types.ts              # Type definitions
├── constants.ts          # EIP-712 constants
├── abi.ts               # Contract ABI
├── client-factory.ts    # Client creation functions
├── signer.ts            # Signer utilities
├── permits.ts           # Permit signing/hashing/verification
├── transactions.ts      # Transaction functions
├── utils.ts             # Utility functions
├── client.ts            # Legacy (backward compatibility)
└── index.ts             # Barrel export
```

## 🎯 Quick Reference

### Types (`types.ts`)

- `PrizeTokenType` - Prize type enum
- `RaffleClient` - Client type
- `HostRafflePermit` - Host permit type
- `JoinRafflePermit` - Join permit type
- `TransactionReport` - Transaction result type

### Constants (`constants.ts`)

- `RAFFLE_EIP712_DOMAIN` - EIP-712 domain constants
- `HOST_RAFFLE_TYPES` - Host permit types
- `JOIN_RAFFLE_TYPES` - Join permit types
- `HOST_AND_JOIN_RAFFLE_TYPES` - Combined permit types

### Client Factory (`client-factory.ts`)

- `createRaffleClient()` - Create client from RPC URL
- `createRaffleClientFromSigner()` - Create client from signer
- `createRaffleClientFromProvider()` - Create read-only client
- `getRaffleContract()` - Get contract instance

### Signer (`signer.ts`)

- `createSignerFromPrivateKey()` - Create signer from private key
- `createSignerFromRpc()` - Create signer with RPC provider
- `getSignerAddress()` - Get signer address
- `createProvider()` - Create provider from RPC URL
- `getNetworkInfo()` - Get network information

### Permits (`permits.ts`)

- `buildRaffleDomain()` - Build EIP-712 domain
- `getRaffleDomainFromClient()` - Get domain from client
- `signHostRafflePermit()` - Sign host permit
- `signJoinRafflePermit()` - Sign join permit
- `signHostAndJoinRafflePermit()` - Sign combined permit
- `hashHostRafflePermit()` - Hash host permit
- `hashJoinRafflePermit()` - Hash join permit
- `hashHostAndJoinRafflePermit()` - Hash combined permit
- `verifyHostRafflePermit()` - Verify host permit signature
- `verifyJoinRafflePermit()` - Verify join permit signature
- `verifyHostAndJoinRafflePermit()` - Verify combined permit signature

### Transactions (`transactions.ts`)

- `unsafeHostRaffleWithReport()` - Host raffle without permit
- `unsafeJoinRaffleWithReport()` - Join raffle without permit
- `hostRaffleWithPermit()` - Host raffle with permit
- `joinRaffleWithPermit()` - Join raffle with permit
- `hostAndJoinRaffleWithPermit()` - Host and join with permit

### Utils (`utils.ts`)

- `parseRaffleLoadDetail()` - Parse load detail from contract
- `parseRaffleResult()` - Parse result from contract
- `getRaffleBytesId()` - Generate bytes32 ID from string

## 📖 Usage Examples

### Create a Signer

```typescript
import { createSignerFromPrivateKey } from "./signer.ts";

const signer = createSignerFromPrivateKey(process.env.PRIVATE_KEY!);
```

### Create a Client

```typescript
import { createRaffleClient } from "./client-factory.ts";

const client = createRaffleClient({
  rpcUrl: "https://sepolia.infura.io/v3/...",
  privateKey: process.env.PRIVATE_KEY,
  raffleAddress: "0x...",
});
```

### Sign a Host Permit

```typescript
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signHostRafflePermit,
  PrizeTokenType,
} from "./index.ts";

const signer = createSignerFromPrivateKey(privateKey);
const domain = buildRaffleDomain(chainId, raffleAddress);

const permit = {
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

const signature = await signHostRafflePermit(signer, domain, permit);
```

### Execute a Transaction

```typescript
import { createRaffleClient } from "./client-factory.ts";
import { hostRaffleWithPermit } from "./transactions.ts";

const client = createRaffleClient({
  rpcUrl: "https://sepolia.infura.io/v3/...",
  privateKey: process.env.ORGANIZER_PRIVATE_KEY,
  raffleAddress: "0x...",
});

const report = await hostRaffleWithPermit(client, params, signature);
console.log("Transaction hash:", report.txHash);
```

## 🔄 Backward Compatibility

The old `client.ts` file is still available for backward compatibility. All functions are re-exported through `index.ts`.

```typescript
// Old way (still works)
import { createRaffleClient, signHostRafflePermit } from "./client.ts";

// New way (recommended)
import { createRaffleClient } from "./client-factory.ts";
import { signHostRafflePermit } from "./permits.ts";

// Or import from index
import { createRaffleClient, signHostRafflePermit } from "./index.ts";
```

## 🎨 Benefits

1. **Easy to Find**: Functions are organized by purpose
2. **Smaller Files**: Each file has a single responsibility
3. **Better Imports**: Import only what you need
4. **Type Safety**: Centralized type definitions
5. **Reusable**: Components can be used independently
6. **Testable**: Easier to unit test individual modules

## 📚 See Also

- [Example Scripts](../../../scripts/permits/) - Example usage in scripts
- [Offchain Service](../../../offchain/) - Integration with offchain service
