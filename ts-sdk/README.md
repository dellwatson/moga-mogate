# @moga/rwa-raffle-sdk

TypeScript SDK for RWA Raffle, built with **Anza Kit** (Solana's modern, tree-shakable TypeScript libraries).

## Features

- ✅ **Anza Kit powered**: Uses `@solana/addresses`, `@solana/instructions`, etc. for optimal tree-shaking
- ✅ **Bun compatible**: ESM-first, works seamlessly with Bun
- ✅ **Minimal bundle size**: Only import what you need
- ✅ **Type-safe**: Full TypeScript support with Kit's modern types

## Installation

```bash
bun add @moga/rwa-raffle-sdk @solana/addresses @solana/instructions @solana/transactions
```

## Usage

### Initialize Raffle (Direct)

```typescript
import { createDirectRaffleIx } from "@moga/rwa-raffle-sdk";
import type { Address } from "@solana/addresses";

const ix = await createDirectRaffleIx({
  programId: "YourProgramId..." as Address,
  organizer: organizerAddress,
  escrowMint: usdcMint,
  escrowAta: escrowTokenAccount,
  requiredTickets: 100n,
  deadlineUnixTs: BigInt(Date.now() / 1000 + 86400 * 7), // 7 days
  autoDraw: true,
  ticketMode: 1, // 0=disabled, 1=require_burn, 2=accept_without_burn
});

// Add to transaction and send
```

### Initialize Raffle (With Permit)

```typescript
import { createRaffleWithPermitIxs } from "@moga/rwa-raffle-sdk";

// 1. Get permit from backend
const permitResponse = await fetch("https://api.example.com/permits/issue", {
  method: "POST",
  body: JSON.stringify({
    organizer: organizerAddress,
    enterpriseId: "your-enterprise-id",
    raffleConfig: {
      requiredTickets: "100",
      deadlineUnixTs: String(Date.now() / 1000 + 86400 * 7),
      autoDraw: true,
      ticketMode: 1,
    },
  }),
});

const { permit } = await permitResponse.json();
const permitMessage = Buffer.from(permit.message, "hex");
const permitNonce = Buffer.from(permit.nonce, "hex");

// 2. Sign message with wallet
const signature = await wallet.signMessage(permitMessage);

// 3. Build instructions
const [edVerifyIx, initIx] = await createRaffleWithPermitIxs({
  programId: programAddress,
  organizer: organizerAddress,
  escrowMint: usdcMint,
  escrowAta: escrowTokenAccount,
  requiredTickets: 100n,
  deadlineUnixTs: BigInt(permit.expiryUnixTs),
  permitMessage,
  permitSignature: signature,
  permitNonce,
  permitExpiryUnixTs: BigInt(permit.expiryUnixTs),
  autoDraw: true,
  ticketMode: 1,
});

// Add both instructions to transaction
```

### PDA Derivation

```typescript
import { deriveRafflePda, deriveTicketPda } from "@moga/rwa-raffle-sdk";

const [raffleAddress, raffleBump] = await deriveRafflePda(
  programId,
  escrowMint,
  organizerAddress
);

const [ticketAddress, ticketBump] = await deriveTicketPda(
  programId,
  raffleAddress,
  userAddress,
  0n // start index
);
```

## Migration from web3.js

This SDK uses **Anza Kit** instead of `@solana/web3.js` for better tree-shaking and modern TypeScript support.

### Key Differences

| web3.js | Anza Kit |
|---------|----------|
| `PublicKey` | `Address` (string type) |
| `TransactionInstruction` | `IInstruction` |
| `Transaction` | Build with `@solana/transactions` |
| Sync PDA derivation | Async PDA derivation |

### Example Migration

**Before (web3.js):**
```typescript
const [raffle] = PublicKey.findProgramAddressSync([...], programId);
```

**After (Anza Kit):**
```typescript
const [raffle] = await deriveRafflePda(programId, mint, organizer);
```

## Account Roles

Kit uses numeric roles instead of boolean flags:

- `0` = readonly
- `1` = writable
- `2` = signer
- `3` = signer + writable

## Development

```bash
# Build
bun run build

# Test
bun test
```

## License

Apache-2.0
