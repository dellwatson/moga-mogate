# Platform Fee Admin - Quick Reference

## 🚀 Quick Commands

### Initialize (First Time)
```bash
# Default: 2.5% fee, your wallet
bun run scripts/fee-admin/1-initialize-config.ts

# Custom: 3% fee
FEE_BPS=300 bun run scripts/fee-admin/1-initialize-config.ts
```

### View Config & Balances
```bash
# Basic view
bun run scripts/fee-admin/4-view-config.ts

# With USDC balance (devnet)
CHECK_MINTS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/4-view-config.ts
```

### Update Fee
```bash
# Change to 3%
FEE_BPS=300 bun run scripts/fee-admin/2-update-config.ts

# Change wallet
FEE_WALLET=NewAddress bun run scripts/fee-admin/2-update-config.ts
```

### Withdraw Fees
```bash
# Withdraw all USDC (devnet)
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/3-withdraw-fees.ts

# Withdraw 100 USDC
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr AMOUNT=100 bun run scripts/fee-admin/3-withdraw-fees.ts
```

---

## 📋 Token Mints

### Devnet
```bash
# USDC
Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
```

### Mainnet
```bash
# USDC
EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# USDT
Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

---

## 💰 Fee Percentages

| BPS | % | Example |
|-----|---|---------|
| 100 | 1% | $100 → $1 fee |
| 250 | 2.5% | $100 → $2.50 fee |
| 300 | 3% | $100 → $3 fee |
| 500 | 5% | $100 → $5 fee |

---

## 🔧 Common Tasks

### Setup New Network
```bash
# 1. Initialize
FEE_BPS=250 bun run scripts/fee-admin/1-initialize-config.ts

# 2. Create token account
spl-token create-account <MINT>

# 3. Verify
bun run scripts/fee-admin/4-view-config.ts
```

### Monthly Collection
```bash
# 1. Check balance
CHECK_MINTS=<USDC_MINT> bun run scripts/fee-admin/4-view-config.ts

# 2. Withdraw
PAYMENT_MINT=<USDC_MINT> bun run scripts/fee-admin/3-withdraw-fees.ts
```

### Change Fee Rate
```bash
# Update
FEE_BPS=<NEW_BPS> bun run scripts/fee-admin/2-update-config.ts

# Verify
bun run scripts/fee-admin/4-view-config.ts
```

---

## 🆘 Troubleshooting

| Error | Solution |
|-------|----------|
| Config not initialized | Run `1-initialize-config.ts` |
| Unauthorized | Use authority wallet |
| Token account not found | `spl-token create-account <MINT>` |
| Fee wallet mismatch | Set `FEE_WALLET_PATH` |

---

## 📁 Files

- `.platform-config-{network}.json` - Config info
- `.fee-withdrawals-{network}.json` - Withdrawal log

---

## 🔐 Security

- ✅ Keep authority wallet secure
- ✅ Use separate fee wallet for production
- ✅ Regular withdrawals
- ✅ Monitor balances

---

## 📚 Full Documentation

See `scripts/fee-admin/README.md` for complete guide.
