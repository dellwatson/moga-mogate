# Getting Started with Platform Fees

## 5-Minute Setup Guide

### Step 1: Initialize Configuration (30 seconds)

```bash
cd /path/to/mogate-rwa-raffle-monorepo

# Initialize with 2.5% fee
bun run scripts/fee-admin/1-initialize-config.ts
```

**Expected output:**
```
✅ Config initialized!
📋 Platform Configuration:
   Authority: 7vK8...
   Fee Wallet: 7vK8...
   Fee BPS: 250 (2.5%)
💾 Config saved to: .platform-config-devnet.json
```

---

### Step 2: Create Token Accounts (1 minute)

Your fee wallet needs a token account for each payment token (USDC, etc.):

```bash
# USDC on devnet
spl-token create-account Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr

# If using custom fee wallet
spl-token create-account Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr --owner <FEE_WALLET_ADDRESS>
```

---

### Step 3: Verify Setup (30 seconds)

```bash
# Check configuration
bun run scripts/fee-admin/4-view-config.ts

# Check with USDC balance
CHECK_MINTS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/4-view-config.ts
```

**Expected output:**
```
📋 Configuration:
   Authority: 7vK8...
   Fee Wallet: 7vK8...
   Fee BPS: 250 (2.5%)

💰 Accumulated Fees:
   USDC (Devnet)
   Balance: 0 USDC
```

---

### Step 4: Test with a Purchase (2 minutes)

Create and buy a test listing to verify fees are collected:

```bash
# 1. Create a test listing (use existing scripts)
# 2. Buy the listing
LISTING=<listing_address> bun run scripts/fee-admin/example-buy-with-fees.ts

# 3. Check accumulated fees
CHECK_MINTS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/4-view-config.ts
```

**Expected output:**
```
💰 Accumulated Fees:
   USDC (Devnet)
   Balance: 2.5 USDC  ← Fee from $100 sale
```

---

### Step 5: Withdraw Fees (30 seconds)

```bash
# Withdraw all accumulated fees
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/3-withdraw-fees.ts
```

**Expected output:**
```
✅ Withdrawal successful!
💰 Updated Balances:
   Fee Wallet: 0
   Destination: 2.5
```

---

## ✅ Setup Complete!

You now have:
- ✅ Platform fee configuration initialized
- ✅ Fee wallet with token accounts
- ✅ Tested fee collection
- ✅ Verified withdrawal works

---

## Daily Operations

### Check Balances
```bash
CHECK_MINTS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/4-view-config.ts
```

### Withdraw Fees
```bash
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/3-withdraw-fees.ts
```

### Update Fee Percentage
```bash
FEE_BPS=300 bun run scripts/fee-admin/2-update-config.ts
```

---

## Common Issues

### "Config not initialized"
**Solution:** Run step 1 first
```bash
bun run scripts/fee-admin/1-initialize-config.ts
```

### "Token account not found"
**Solution:** Create token account (step 2)
```bash
spl-token create-account <MINT_ADDRESS>
```

### "Insufficient balance"
**Solution:** Fund buyer wallet with payment tokens
```bash
spl-token transfer <MINT> <AMOUNT> <BUYER_ADDRESS>
```

---

## Next Steps

1. **Update Frontend** - Integrate config PDA and fee wallet ATA in buy transactions
2. **Deploy to Mainnet** - Repeat steps 1-2 with `SOLANA_NETWORK=mainnet`
3. **Set Up Monitoring** - Create dashboard to track accumulated fees
4. **Automate Withdrawals** - Set up monthly cron job for fee collection

---

## Need Help?

- 📚 Full guide: `scripts/fee-admin/README.md`
- 🚀 Quick reference: `scripts/fee-admin/QUICK_REFERENCE.md`
- 📖 System docs: `docs/PLATFORM_FEE_SYSTEM.md`
- 💻 Example code: `scripts/fee-admin/example-buy-with-fees.ts`

---

## Scripts Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `1-initialize-config.ts` | Set up fee system | Once per network |
| `2-update-config.ts` | Change settings | When updating fee/wallet |
| `3-withdraw-fees.ts` | Collect fees | Monthly/as needed |
| `4-view-config.ts` | Check status | Anytime |
| `example-buy-with-fees.ts` | Test purchase | Testing/development |

---

## Production Checklist

Before going live on mainnet:

- [ ] Test all scripts on devnet
- [ ] Verify fee calculations are correct
- [ ] Test withdrawal process
- [ ] Secure authority wallet (hardware wallet recommended)
- [ ] Create separate fee wallet (optional but recommended)
- [ ] Set up monitoring/alerts for fee accumulation
- [ ] Document fee percentage for users
- [ ] Update frontend to include config & fee_wallet_ata
- [ ] Test end-to-end purchase flow
- [ ] Create withdrawal schedule/process

---

**Ready to go!** 🚀
