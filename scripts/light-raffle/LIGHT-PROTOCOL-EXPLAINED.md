# Light Protocol Integration - Explained

## ❌ Common Misconception

**WRONG**: "Light Protocol is just for privacy/encryption"
**RIGHT**: "Light Protocol enables ZK state compression to reduce storage costs"

## 🎯 What Light Protocol Actually Does

Light Protocol uses **zero-knowledge proofs** to compress on-chain state into Merkle trees, drastically reducing storage costs.

### Without Light Protocol (Standard Raffle)

```rust
pub struct RaffleSlots {
    pub raffle: Pubkey,           // 32 bytes
    pub total_slots: u32,         // 4 bytes
    pub slot_owners: Vec<Pubkey>, // 32 bytes × N slots
}

// Example: 1000 slots
// Storage: 32 + 4 + (32 × 1000) = 32,036 bytes
// Rent: ~0.22 SOL (~$22 at $100/SOL)
```

### With Light Protocol (ZK-Compressed Raffle)

```rust
pub struct RaffleSlots {
    pub raffle: Pubkey,      // 32 bytes
    pub total_slots: u32,    // 4 bytes
    pub sold_slots: u32,     // 4 bytes (just a counter!)
    // slot_owners stored in Light Protocol compressed accounts
}

// Example: 1000 slots
// On-chain storage: 32 + 4 + 4 = 40 bytes
// Rent: ~0.0003 SOL (~$0.03 at $100/SOL)
// Savings: 99.86% reduction!
```

## 🔑 How It Works

### 1. Compressed Account Storage

Instead of storing each slot owner on-chain:

```
Slot 1 → Owner A (32 bytes)
Slot 2 → Owner B (32 bytes)
Slot 3 → Owner C (32 bytes)
...
```

Light Protocol stores them in a **Merkle tree**:

```
Root Hash (32 bytes)
├─ Branch Hash
│  ├─ Leaf: Owner A
│  └─ Leaf: Owner B
└─ Branch Hash
   └─ Leaf: Owner C
```

### 2. Merkle Proofs

To prove ownership, you provide a **Merkle proof** (path from leaf to root):

```rust
pub fn join_raffle(
    slot_ids: Vec<u32>,
    merkle_proofs: Vec<Vec<[u8; 32]>>,  // Proof path
)
```

For "unsafe" join (testing), we skip proofs:

```rust
merkle_proofs: vec![]  // Empty = no verification
```

### 3. State Tree Account

Light Protocol maintains a **state tree** account that stores the Merkle root:

```
CmtE9W6JZHSKJuZkZvJy6vLJkZ8KnKJzKxDLQjLvVJHw
```

This is why we need to pass it to the instruction!

## 📊 Cost Comparison

| Operation               | Standard  | ZK-Compressed | Savings |
| ----------------------- | --------- | ------------- | ------- |
| Create 100-slot raffle  | 0.022 SOL | 0.0003 SOL    | 98.6%   |
| Create 1000-slot raffle | 0.22 SOL  | 0.0003 SOL    | 99.86%  |
| Join raffle (1 slot)    | 0.002 SOL | 0.00001 SOL   | 99.5%   |

## 🔧 Required Accounts

### Standard Raffle (7 accounts)

1. `payer` - User paying for transaction
2. `config` - Global raffle config
3. `raffle` - Raffle account
4. `slots` - Slot ownership array
5. `userRaffle` - User's raffle participation
6. `treasury` - Payment destination
7. `systemProgram` - Solana system program

### ZK-Compressed Raffle (9 accounts = +2)

1-7. Same as above 8. **`lightStateTree`** - Light Protocol state tree (stores Merkle root) 9. **`lightSystemProgram`** - Light Protocol system program (manages compression)

## 🚨 Why Scripts Failed Initially

### Problem

```
❌ Error: Account `payer` not provided
```

### Root Cause

Anchor's IDL parser couldn't deserialize the accounts section properly, causing it to fail before even building the transaction.

### Solution

**Use raw Solana transactions** instead of Anchor:

```typescript
// ❌ Anchor way (broken)
const tx = await program.methods
  .unsafeJoinRaffle(...)
  .rpc();

// ✅ Raw way (works)
const instruction = new TransactionInstruction({
  programId,
  keys: [...accounts],
  data: serializedData,
});
const tx = new Transaction().add(instruction);
await sendAndConfirmTransaction(connection, tx, [signer]);
```

## 📝 Instruction Data Format

```
[8 bytes] Discriminator (SHA256("global:unsafe_join_raffle")[0:8])
[4 bytes] Vec<u32> length
[N×4 bytes] Slot IDs (u32 each)
[8 bytes] Amount (u64)
[4 bytes] Vec<Vec<[u8; 32]>> length (always 0 for unsafe)
```

Example for slots [1,2,3] with 0.0255 SOL:

```
401e93504d30573b  // Discriminator
03000000          // Vec length = 3
01000000          // Slot 1
02000000          // Slot 2
03000000          // Slot 3
6019850100000000  // Amount = 25,500,000 lamports
00000000          // Empty merkle proofs
```

## 🎓 Key Takeaways

1. **Light Protocol ≠ Privacy** - It's about compression, not encryption
2. **Merkle Trees** - Enable proving ownership without storing all data on-chain
3. **Cost Savings** - 99%+ reduction in storage costs
4. **Trade-off** - Slightly more complex (need proofs), but worth it for large raffles
5. **Two Extra Accounts** - Always include `lightStateTree` and `lightSystemProgram`

## 🔗 Learn More

- [Light Protocol Docs](https://docs.lightprotocol.com)
- [ZK Compression Explained](https://www.lightprotocol.com/post/zk-compression)
- [Solana State Compression](https://docs.solana.com/learn/state-compression)
