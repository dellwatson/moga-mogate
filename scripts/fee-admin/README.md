# Platform Fee Administration Scripts

Complete guide for managing the platform fee system in `direct_sell_anchor`.

## Overview

These scripts allow you to:
- ✅ Initialize platform fee configuration
- ✅ Update fee percentage and wallet
- ✅ Withdraw accumulated fees
- ✅ Monitor configuration and balances

---

## Quick Start

### 1. Initialize Config (First Time Only)

Set up your fee wallet and percentage:

```bash
# Use default settings (2.5% fee, authority wallet as fee wallet)
bun run scripts/fee-admin/1-initialize-config.ts

# Custom fee percentage (3%)
FEE_BPS=300 bun run scripts/fee-admin/1-initialize-config.ts

# Custom fee wallet
FEE_WALLET=YourWalletAddressHere bun run scripts/fee-admin/1-initialize-config.ts

# Both custom
FEE_BPS=250 FEE_WALLET=YourWalletAddressHere bun run scripts/fee-admin/1-initialize-config.ts
```

**Output:**
```
✅ Config initialized!
   Transaction: 5x7Ky...
   
📋 Platform Configuration:
   Authority: 7vK8...
   Fee Wallet: 7vK8...
   Fee BPS: 250 (2.5%)
   
💾 Config saved to: .platform-config-devnet.json
```

---

### 2. View Current Config

Check your current settings and accumulated fees:

```bash
# Basic view
bun run scripts/fee-admin/4-view-config.ts

# Check USDC balance
CHECK_MINTS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/4-view-config.ts

# Check multiple tokens
CHECK_MINTS="mint1,mint2,mint3" bun run scripts/fee-admin/4-view-config.ts
```

**Output:**
```
📋 Configuration:
   Authority: 7vK8...
   Fee Wallet: 7vK8...
   Fee BPS: 250 (2.5%)
   
💵 Fee Examples:
   $100 sale → Platform: $2.50, Seller: $97.50
   
💰 Accumulated Fees:
   USDC (Devnet)
   Balance: 125.50 USDC
```

---

### 3. Update Config

Change fee percentage or wallet address:

```bash
# Update fee to 3%
FEE_BPS=300 bun run scripts/fee-admin/2-update-config.ts

# Update fee wallet
FEE_WALLET=NewWalletAddress bun run scripts/fee-admin/2-update-config.ts

# Update both
FEE_BPS=200 FEE_WALLET=NewWalletAddress bun run scripts/fee-admin/2-update-config.ts
```

**Output:**
```
📋 Current Configuration:
   Fee BPS: 250 (2.5%)
   
🔄 Proposed Changes:
   Fee BPS: 250 → 300 (3%)
   
✅ Config updated!
```

---

### 4. Withdraw Fees

Transfer accumulated fees to your wallet:

```bash
# Withdraw all USDC fees
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/3-withdraw-fees.ts

# Withdraw specific amount (100 USDC)
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr AMOUNT=100 bun run scripts/fee-admin/3-withdraw-fees.ts

# Withdraw to different wallet
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr DESTINATION=AnotherWallet bun run scripts/fee-admin/3-withdraw-fees.ts
```

**Output:**
```
💰 Fee Wallet Balance: 125.50 USDC

💸 Withdrawal Details:
   Amount: 125.50
   Remaining: 0
   
✅ Withdrawal successful!
   Transaction: 3kL9...
   
💰 Updated Balances:
   Fee Wallet: 0
   Destination: 125.50
```

---

## Environment Variables

### Common Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOLANA_NETWORK` | Network (devnet/mainnet) | `devnet` |
| `SOLANA_RPC_URL` | Custom RPC endpoint | Network default |
| `WALLET_PATH` | Authority wallet keypair | `~/.config/solana/id.json` |

### Script-Specific Variables

#### 1-initialize-config.ts
| Variable | Description | Default |
|----------|-------------|---------|
| `FEE_BPS` | Fee in basis points (0-1000) | `250` (2.5%) |
| `FEE_WALLET` | Fee wallet address | Authority wallet |

#### 2-update-config.ts
| Variable | Description | Required |
|----------|-------------|----------|
| `FEE_BPS` | New fee percentage | No |
| `FEE_WALLET` | New fee wallet | No |

*At least one must be provided*

#### 3-withdraw-fees.ts
| Variable | Description | Required |
|----------|-------------|----------|
| `PAYMENT_MINT` | Token mint address | **Yes** |
| `AMOUNT` | Amount to withdraw | No (withdraws all) |
| `DESTINATION` | Destination wallet | No (uses authority) |
| `FEE_WALLET_PATH` | Fee wallet keypair | No (uses WALLET_PATH) |

#### 4-view-config.ts
| Variable | Description | Required |
|----------|-------------|----------|
| `CHECK_MINTS` | Comma-separated mint addresses | No |

---

## Common Token Mints

### Devnet
```bash
# USDC (Devnet)
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr

# Your custom token
PAYMENT_MINT=YourTokenMintAddress
```

### Mainnet
```bash
# USDC (Mainnet)
PAYMENT_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# USDT (Mainnet)
PAYMENT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

---

## Fee Percentage Guide

| BPS | Percentage | $100 Sale | Platform | Seller |
|-----|------------|-----------|----------|--------|
| 100 | 1% | $100 | $1.00 | $99.00 |
| 150 | 1.5% | $100 | $1.50 | $98.50 |
| 200 | 2% | $100 | $2.00 | $98.00 |
| **250** | **2.5%** | **$100** | **$2.50** | **$97.50** |
| 300 | 3% | $100 | $3.00 | $97.00 |
| 500 | 5% | $100 | $5.00 | $95.00 |
| 1000 | 10% (max) | $100 | $10.00 | $90.00 |

**Recommended:** 2-5% (200-500 BPS)

---

## Workflow Examples

### Initial Setup (Devnet)

```bash
# 1. Initialize with 2.5% fee
FEE_BPS=250 bun run scripts/fee-admin/1-initialize-config.ts

# 2. Create fee wallet token account for USDC
spl-token create-account Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr

# 3. View config
bun run scripts/fee-admin/4-view-config.ts

# 4. Test by creating and buying a listing
# (fees will accumulate in fee wallet)

# 5. Check accumulated fees
CHECK_MINTS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/4-view-config.ts

# 6. Withdraw fees
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/3-withdraw-fees.ts
```

### Monthly Fee Collection

```bash
# Check balances
CHECK_MINTS=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/4-view-config.ts

# Withdraw all USDC fees
PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/3-withdraw-fees.ts

# Check withdrawal history
bun run scripts/fee-admin/4-view-config.ts
```

### Changing Fee Percentage

```bash
# View current fee
bun run scripts/fee-admin/4-view-config.ts

# Update to 3%
FEE_BPS=300 bun run scripts/fee-admin/2-update-config.ts

# Verify change
bun run scripts/fee-admin/4-view-config.ts
```

### Using Separate Fee Wallet

```bash
# 1. Generate new fee wallet
solana-keygen new -o fee-wallet.json

# 2. Initialize with separate wallet
FEE_WALLET=$(solana-keygen pubkey fee-wallet.json) bun run scripts/fee-admin/1-initialize-config.ts

# 3. Create token accounts for fee wallet
spl-token create-account Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr --owner $(solana-keygen pubkey fee-wallet.json)

# 4. Withdraw fees (fee wallet must sign)
FEE_WALLET_PATH=fee-wallet.json PAYMENT_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr bun run scripts/fee-admin/3-withdraw-fees.ts
```

---

## Troubleshooting

### "Config not initialized"
```bash
# Run initialization first
bun run scripts/fee-admin/1-initialize-config.ts
```

### "Unauthorized"
```bash
# Make sure you're using the authority wallet
WALLET_PATH=/path/to/authority/wallet.json bun run scripts/fee-admin/...
```

### "Fee wallet token account not found"
```bash
# Create token account for fee wallet
spl-token create-account <MINT_ADDRESS> --owner <FEE_WALLET_ADDRESS>

# Or if fee wallet is your wallet
spl-token create-account <MINT_ADDRESS>
```

### "Destination token account doesn't exist"
```bash
# Create token account for destination
spl-token create-account <MINT_ADDRESS>
```

### "Fee wallet mismatch"
```bash
# If using separate fee wallet, specify the keypair path
FEE_WALLET_PATH=/path/to/fee-wallet.json bun run scripts/fee-admin/3-withdraw-fees.ts
```

---

## Security Best Practices

### 1. Protect Authority Wallet
- Store authority wallet keypair securely
- Use hardware wallet for mainnet
- Never commit keypairs to git

### 2. Separate Fee Wallet (Recommended for Production)
```bash
# Generate dedicated fee wallet
solana-keygen new -o fee-wallet-mainnet.json

# Store securely (encrypted backup)
# Use for fee collection only
```

### 3. Regular Withdrawals
```bash
# Set up monthly cron job
0 0 1 * * cd /path/to/project && PAYMENT_MINT=<USDC> bun run scripts/fee-admin/3-withdraw-fees.ts
```

### 4. Monitor Fees
```bash
# Daily balance check
CHECK_MINTS=<USDC>,<USDT> bun run scripts/fee-admin/4-view-config.ts
```

---

## Generated Files

| File | Description |
|------|-------------|
| `.platform-config-devnet.json` | Saved config for devnet |
| `.platform-config-mainnet.json` | Saved config for mainnet |
| `.fee-withdrawals-devnet.json` | Withdrawal history for devnet |
| `.fee-withdrawals-mainnet.json` | Withdrawal history for mainnet |

**Note:** These files are gitignored for security.

---

## Integration with Frontend

After initializing config, update your buy transaction:

```typescript
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

// Load config
const configInfo = require("./.platform-config-devnet.json");
const configPda = new PublicKey(configInfo.configPda);
const feeWallet = new PublicKey(configInfo.feeWallet);

// Get fee wallet ATA for payment mint
const feeWalletAta = await getAssociatedTokenAddress(
  paymentMint,
  feeWallet
);

// Buy listing with fee
await program.methods
  .buyListing()
  .accounts({
    buyer: buyer.publicKey,
    seller: listing.seller,
    listing: listingPda,
    config: configPda,  // ← Add this
    nftMint: nftMint,
    paymentMint: paymentMint,
    buyerPaymentAta: buyerPaymentAta,
    sellerPaymentAta: sellerPaymentAta,
    feeWalletAta: feeWalletAta,  // ← Add this
    listingNftEscrow: listingNftEscrow,
    buyerNftAta: buyerNftAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review `docs/PLATFORM_FEE_SYSTEM.md`
3. Check program logs with `ANCHOR_LOG=true`

---

## Next Steps

1. ✅ Initialize config on devnet
2. ✅ Test fee collection with test transactions
3. ✅ Verify withdrawal works
4. ✅ Update frontend integration
5. ✅ Deploy to mainnet
6. ✅ Set up monitoring and regular withdrawals
