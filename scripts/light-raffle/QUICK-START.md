# Quick Start - ZK-Compressed Raffle

## 🚀 TL;DR

```bash
# 1. Host a raffle
bun run scripts/light-raffle/host-raffle.ts

# 2. Join with different accounts
WALLET=account1 bun run scripts/light-raffle/join-raffle.ts 1,2,3
WALLET=account2 bun run scripts/light-raffle/join-raffle.ts 10,11,12
WALLET=account3 bun run scripts/light-raffle/join-raffle.ts 49,50
```

## 📋 Files

- `host-raffle.ts` - Create raffle
- `join-raffle.ts` - Book slots
- `raffle-info.json` - Current raffle data
- `README.md` - Full documentation

## 🔑 Wallet Setup

Add to `.env`:

```bash
SOL_PVT_KEY=<base58-private-key-for-account2>
SOL_PVT_KEY_2=<base58-private-key-for-account3>
```

Account 1 uses default CLI wallet (`~/.config/solana/id.json`)

## ⚡ Key Differences from Standard Raffle

### Standard Raffle

- Stores slots in on-chain array
- Limited to ~1000 slots
- ~0.002 SOL per slot

### ZK-Compressed Raffle

- Stores slots in Light Protocol compressed accounts
- Unlimited slots
- ~0.00001 SOL per slot
- Requires 2 extra accounts: `lightStateTree` + `lightSystemProgram`

## 🎯 Current Test Raffle

**Raffle ID**: `zk-50slots-1769986509824`
**PDA**: `GgQkPVRLgMCypCEajHr91UBqfkKrcpLdhU8Yty8kYJ68`
**Slots**: 50 total, 8 booked

**Booked slots:**

- Account 1: 1, 2, 3
- Account 2: 10, 11, 12
- Account 3: 49, 50

## 🔗 Links

- [Full README](./README.md)
- [Program on Explorer](https://explorer.solana.com/address/6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44?cluster=devnet)
- [Light Protocol Docs](https://docs.lightprotocol.com)
