## Permit Scripts

Example scripts demonstrating how to use the modular ts-sdk to create raffle permits.

### Features

- ✅ **Modular**: Uses ts-sdk's modular components
- ✅ **Reusable**: No code duplication (DRY principle)
- ✅ **Type-safe**: Full TypeScript support
- ✅ **Configurable**: Easy to update parameters

### Scripts

#### `create-host-permit.ts`

Creates a host raffle permit using the backend signer.

**Usage:**

```bash
# Set environment variables
export BACKEND_SIGNER_PRIVATE_KEY="0x..."
export CHAIN_ID="11155111"
export RAFFLE_ADDRESS="0x..."
export ORGANIZER_ADDRESS="0x..."

# Run script
bun run scripts/permits/create-host-permit.ts
```

#### `create-join-permit.ts`

Creates a join raffle permit using the backend signer.

**Usage:**

```bash
# Set environment variables
export BACKEND_SIGNER_PRIVATE_KEY="0x..."
export CHAIN_ID="11155111"
export RAFFLE_ADDRESS="0x..."
export PAYER_ADDRESS="0x..."
export RAFFLE_ID="raffle-123"

# Run script
bun run scripts/permits/create-join-permit.ts
```

### Modular Components Used

From `ts-sdk/src/evm/`:

1. **Signer** (`signer.ts`)

   - `createSignerFromPrivateKey()` - Create signer from private key

2. **Permits** (`permits.ts`)

   - `buildRaffleDomain()` - Build EIP-712 domain
   - `signHostRafflePermit()` - Sign host permit
   - `signJoinRafflePermit()` - Sign join permit
   - `hashHostRafflePermit()` - Hash host permit
   - `hashJoinRafflePermit()` - Hash join permit

3. **Types** (`types.ts`)
   - `HostRafflePermit` - Host permit type
   - `JoinRafflePermit` - Join permit type
   - `PrizeTokenType` - Prize type enum

### Example: Custom Configuration

```typescript
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signHostRafflePermit,
  PrizeTokenType,
} from "../../ts-sdk/src/evm/index.ts";

// Your custom raffle configuration
const myRaffleConfig = {
  raffleId: "my-custom-raffle",
  totalSlots: 50n,
  maxSlotsPerAddress: 3n,
  metadataUri: "https://my-app.com/raffle.json",
  collection: "0x...",
  prizeType: PrizeTokenType.ERC721,
  prizeAmount: 1n,
  autoDraw: true,
  autoClaim: false,
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
  organizer: "0x...",
};

// Create signer
const signer = createSignerFromPrivateKey(process.env.PRIVATE_KEY!);

// Build domain
const domain = buildRaffleDomain(chainId, raffleAddress);

// Sign permit
const signature = await signHostRafflePermit(signer, domain, myRaffleConfig);
```

### Benefits

1. **No Code Duplication**: Reuses ts-sdk utilities
2. **Easy to Update**: Change config in one place
3. **Type Safety**: TypeScript catches errors at compile time
4. **Modular**: Import only what you need
5. **Testable**: Easy to unit test individual components

### Integration with Offchain Service

These scripts can be integrated with the offchain service:

```typescript
// In offchain/src/services/permit.ts
import {
  createSignerFromPrivateKey,
  buildRaffleDomain,
  signHostRafflePermit,
} from "@moga/rwa-raffle-ts-sdk/src/evm";

export async function createHostPermit(config: HostPermitConfig) {
  const signer = createSignerFromPrivateKey(config.privateKey);
  const domain = buildRaffleDomain(config.chainId, config.raffleAddress);
  return signHostRafflePermit(signer, domain, config.params);
}
```
