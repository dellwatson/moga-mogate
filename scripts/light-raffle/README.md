# ZK-Compressed Raffle Scripts (Light Protocol)

This folder contains scripts for the **ZK-compressed raffle program** using Light Protocol's state compression.

## 🎯 What is ZK Compression?

Traditional Solana raffles store slot ownership in a **giant array** on-chain:

```rust
// ❌ OLD WAY (expensive, limited slots)
pub struct RaffleSlots {
    slot_owners: Vec<Pubkey>,  // 32 bytes × 1000 slots = 32KB!
}
```

ZK-compressed raffles use **Light Protocol** to store slot ownership in **compressed accounts**:

```rust
// ✅ NEW WAY (cheap, unlimited slots)
pub struct RaffleSlots {
    sold_slots: u32,  // Just a counter! (4 bytes)
}
// Actual ownership stored in Light Protocol's compressed state tree
```

### Key Differences

| Feature          | Standard Raffle               | ZK-Compressed Raffle |
| ---------------- | ----------------------------- | -------------------- |
| Slot storage     | On-chain array                | Compressed accounts  |
| Cost per slot    | ~0.002 SOL                    | ~0.00001 SOL         |
| Max slots        | ~1000                         | Unlimited            |
| Slot query       | Direct array read             | Light Protocol query |
| Program accounts | 3 (Raffle, Slots, UserRaffle) | 3 + Light Protocol   |

## 📁 Files

### Core Scripts

- **`host-raffle.ts`** - Create a new ZK-compressed raffle
- **`join-raffle.ts`** - Join a raffle (book slots) - **RAW SOLANA, NO ANCHOR**

### Data Files

- **`multi_raffle_light.json`** - Program IDL (generated from `anchor build`)
- **`raffle-info.json`** - Current raffle details (auto-generated)

## 🚀 Usage

### 1. Host a New Raffle

```bash
bun run scripts/light-raffle/host-raffle.ts
```

This creates a raffle and saves info to `raffle-info.json`.

**Edit the script** to customize:

- `totalSlots` - Number of slots (default: 10)
- `maxSlotsPerAddress` - Max slots per user (default: 5)
- `raffleId` - Unique identifier

### 2. Join a Raffle

```bash
# Account 1 (default CLI wallet)
WALLET=account1 bun run scripts/light-raffle/join-raffle.ts 1,2,3

# Account 2 (from SOL_PVT_KEY in .env)
WALLET=account2 bun run scripts/light-raffle/join-raffle.ts 10,11,12

# Account 3 (from SOL_PVT_KEY_2 in .env)
WALLET=account3 bun run scripts/light-raffle/join-raffle.ts 49,50
```

**Parameters:**

- `WALLET` - Which account to use (account1/account2/account3)
- Slot IDs - Comma-separated list of slots to book

## 🔑 Light Protocol Integration

The ZK-compressed raffle requires **two additional accounts** compared to standard raffles:

```typescript
// Standard raffle accounts
{
  (payer, config, raffle, slots, userRaffle, treasury, systemProgram);
}

// ZK-compressed raffle accounts (+ 2 more)
{
  (payer,
    config,
    raffle,
    slots,
    userRaffle,
    lightStateTree, // ← Light Protocol state tree
    lightSystemProgram, // ← Light Protocol system program
    treasury,
    systemProgram);
}
```

### Light Protocol Addresses (Devnet)

```typescript
const LIGHT_STATE_TREE = "CmtE9W6JZHSKJuZkZvJy6vLJkZ8KnKJzKxDLQjLvVJHw";
const LIGHT_SYSTEM_PROGRAM = "H5sFv8VwWmjxHYS2GB4fTDsK7uTtnRT4WiixtHrET3bN";
```

## 📊 Instruction Data Format

The `unsafe_join_raffle` instruction expects:

```rust
pub fn unsafe_join_raffle(
    ctx: Context<UnsafeJoinRaffle>,
    slot_ids: Vec<u32>,           // Slots to book
    amount: u64,                  // Payment amount in lamports
    merkle_proofs: Vec<Vec<[u8; 32]>>,  // Empty for unsafe join
) -> Result<()>
```

**Serialization:**

```
[8-byte discriminator]
[4-byte Vec length][slot_ids...]  // Vec<u32>
[8-byte amount]                    // u64
[4-byte Vec length]                // Vec<Vec<[u8; 32]>> - always 0 for unsafe
```

## ⚠️ Why NOT Anchor?

The `join-raffle.ts` script uses **raw Solana transactions** instead of Anchor because:

1. **IDL Issues** - The generated IDL was missing the `accounts` section, causing Anchor to fail
2. **Simpler** - Direct transaction building is more straightforward
3. **No Dependencies** - Works without Anchor's account parsing
4. **More Control** - Explicit account ordering and data serialization

## 🔍 Debugging

### Check Raffle Status

```bash
solana account <RAFFLE_PDA> --url devnet
```

### View Transaction

```bash
solana confirm <SIGNATURE> --url devnet -v
```

### Common Errors

**"Account `payer` not provided"**

- Anchor version issue with IDL parsing
- Solution: Use raw transaction script (`join-raffle.ts`)

**"InstructionDidNotDeserialize"**

- Wrong instruction data format
- Check: discriminator, Vec lengths, merkle_proofs parameter

**"AccountNotEnoughKeys"**

- Missing Light Protocol accounts
- Check: `lightStateTree` and `lightSystemProgram` are included

## 📝 Environment Variables

Add to `.env`:

```bash
# Account 2
SOL_PVT_KEY=<base58-private-key>

# Account 3
SOL_PVT_KEY_2=<base58-private-key>
```

## 🎯 Current Raffle

Check `raffle-info.json` for the latest raffle details:

- Raffle ID
- Program PDAs
- Total slots
- Creation timestamp

## 🔗 Resources

- **Program ID**: `6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44`
- **Network**: Devnet
- **Light Protocol Docs**: https://docs.lightprotocol.com
- **Explorer**: https://explorer.solana.com/?cluster=devnet
