# Deployment Scripts Guide

This directory contains deployment and setup scripts for the Mogate RWA Raffle platform.

## 📋 Prerequisites

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Set Up Wallet**
   ```bash
   # Generate new wallet (if needed)
   solana-keygen new --outfile ~/.config/solana/id.json
   
   # Or use existing wallet
   export WALLET_PATH=~/.config/solana/id.json
   ```

3. **Get SOL (Devnet)**
   ```bash
   solana config set --url devnet
   solana airdrop 2
   ```

4. **Set Network**
   ```bash
   # For devnet (default)
   export SOLANA_NETWORK=devnet
   
   # For mainnet
   export SOLANA_NETWORK=mainnet
   ```

---

## 🚀 Deployment Steps

### Step 1: Deploy MOGA Token

Creates the MOGA SPL token with initial supply.

```bash
bun run scripts/1-deploy-moga-token.ts
```

**What it does:**
- Creates MOGA token mint (9 decimals)
- Mints initial supply (1 billion MOGA)
- Creates associated token account for deployer
- Saves config to `.moga-token.json`

**Output:**
```
MOGA Token Mint: MogaM1nt111111111111111111111111111111111
```

**Add to `.env`:**
```bash
MOGA_MINT_DEVNET=MogaM1nt111111111111111111111111111111111
```

---

### Step 2: Create Prize Collection NFT

Creates the collection NFT that all prize NFTs will belong to.

```bash
bun run scripts/2-create-prize-collection.ts
```

**What it does:**
- Uploads collection metadata to Arweave
- Creates collection NFT "Mogate RWA Prizes"
- Sets you as update authority
- Saves config to `.prize-collection.json`

**Output:**
```
Collection Mint: CoLLect1oN1111111111111111111111111111111
```

**Add to `.env`:**
```bash
PRIZE_COLLECTION_MINT_DEVNET=CoLLect1oN1111111111111111111111111111111
```

---

### Step 3: Delegate Collection Authority

Delegates collection verification authority to your programs.

```bash
bun run scripts/3-delegate-collection-authority.ts
```

**What it does:**
- Derives collection authority PDAs for each program
- Delegates verification rights to PDAs
- Verifies delegations
- Saves config to `.collection-delegations.json`

**Output:**
```
rwa_raffle PDA: Auth0r1tyPDA111111111111111111111111111
direct_sell PDA: Auth0r1tyPDA222222222222222222222222222
```

**Update program code:**
```rust
// programs/rwa_raffle/src/lib.rs
pub const PRIZE_COLLECTION_MINT: Pubkey = pubkey!("CoLLect1oN1111111111111111111111111111111");

// programs/direct_sell/src/lib.rs
pub const PRIZE_COLLECTION_MINT: Pubkey = pubkey!("CoLLect1oN1111111111111111111111111111111");
```

---

### Step 4: Deploy Programs

Build and deploy your Solana programs.

```bash
# Build programs
anchor build

# Or with specific features
cargo build-sbf --manifest-path programs/rwa_raffle/Cargo.toml \
  --features metaplex,pyth-jupiter,bubblegum

cargo build-sbf --manifest-path programs/direct_sell/Cargo.toml \
  --features pyth-jupiter

# Deploy to devnet
solana program deploy target/deploy/rwa_raffle.so --program-id programs/rwa_raffle/target/deploy/rwa_raffle-keypair.json
solana program deploy target/deploy/direct_sell.so --program-id programs/direct_sell/target/deploy/direct_sell-keypair.json
```

**Update `Anchor.toml` with deployed program IDs.**

---

## 📁 Generated Files

After running the scripts, you'll have:

```
.moga-token.json              # MOGA token configuration
.prize-collection.json        # Prize collection NFT configuration
.collection-delegations.json  # Collection authority delegations
```

**⚠️ Important:** These files contain deployment info. Back them up!

---

## 🔄 Complete Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Deploy MOGA Token                                       │
│     bun run scripts/1-deploy-moga-token.ts                  │
│     → Creates MOGA SPL token                                │
│     → Output: MOGA_MINT address                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Create Prize Collection                                 │
│     bun run scripts/2-create-prize-collection.ts            │
│     → Creates collection NFT                                │
│     → Output: PRIZE_COLLECTION_MINT address                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Delegate Collection Authority                           │
│     bun run scripts/3-delegate-collection-authority.ts      │
│     → Delegates to program PDAs                             │
│     → Output: Collection authority PDAs                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Update Program Code                                     │
│     → Add PRIZE_COLLECTION_MINT constant                    │
│     → Rebuild programs                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Deploy Programs                                         │
│     anchor build && anchor deploy                           │
│     → Deploy to devnet/mainnet                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Test on Devnet                                          │
│     → Create test raffle                                    │
│     → Buy tickets with MOGA                                 │
│     → Draw winner                                           │
│     → Claim prize NFT                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Scripts

### Test MOGA Token

```bash
bun run scripts/test-moga-token.ts
```

Verifies:
- MOGA token exists
- Correct decimals (9)
- Initial supply minted
- Can create ATAs

### Test Prize Collection

```bash
bun run scripts/test-prize-collection.ts
```

Verifies:
- Collection NFT exists
- Metadata uploaded
- Is marked as collection
- Update authority correct

### Test Collection Delegation

```bash
bun run scripts/test-collection-delegation.ts
```

Verifies:
- PDAs derived correctly
- Authority delegated
- Programs can verify NFTs

---

## 🔧 Utility Scripts

### Check Balances

```bash
bun run scripts/check-balances.ts
```

Shows:
- SOL balance
- MOGA balance
- All token accounts

### Revoke Collection Authority

```bash
bun run scripts/revoke-collection-authority.ts
```

Revokes collection authority from a program (if needed).

### Update Collection Metadata

```bash
bun run scripts/update-collection-metadata.ts
```

Updates collection NFT metadata (image, description, etc.).

---

## 🌐 Network Configuration

### Devnet (Default)

```bash
export SOLANA_NETWORK=devnet
export SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Mainnet

```bash
export SOLANA_NETWORK=mainnet
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# Or use a paid RPC for better performance:
# export SOLANA_RPC_URL=https://your-rpc-provider.com
```

### Custom RPC

```bash
export SOLANA_RPC_URL=https://your-custom-rpc.com
```

---

## 📝 Environment Variables

Create a `.env` file in the root directory:

```bash
# Network
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# Wallet
WALLET_PATH=~/.config/solana/id.json

# Token Addresses (filled after deployment)
MOGA_MINT_DEVNET=
PRIZE_COLLECTION_MINT_DEVNET=

# Mainnet (when ready)
MOGA_MINT_MAINNET=
PRIZE_COLLECTION_MINT_MAINNET=

# Program IDs (from Anchor.toml)
RWA_RAFFLE_PROGRAM_ID=5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M
DIRECT_SELL_PROGRAM_ID=Di1ectSe11111111111111111111111111111111111
RWA_REDEEM_PROGRAM_ID=RwaRede3m1111111111111111111111111111111111
```

---

## 🚨 Troubleshooting

### "Insufficient balance"

```bash
# Devnet: Get more SOL
solana airdrop 2

# Mainnet: Transfer SOL to your wallet
```

### "Collection already exists"

```bash
# Delete config file to recreate
rm .prize-collection.json
bun run scripts/2-create-prize-collection.ts
```

### "Program not found"

```bash
# Make sure programs are deployed
anchor build
anchor deploy

# Or check program IDs in Anchor.toml
```

### "Metadata upload failed"

```bash
# Check Bundlr balance (for Arweave uploads)
# You need SOL in your wallet for Bundlr storage

# Or use a different storage provider
# Edit scripts to use IPFS, AWS S3, etc.
```

---

## 📚 Additional Resources

- [Solana CLI Docs](https://docs.solana.com/cli)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Metaplex Docs](https://docs.metaplex.com/)
- [SPL Token Program](https://spl.solana.com/token)

---

## 🔐 Security Notes

1. **Never commit private keys** - Keep wallet files secure
2. **Backup deployment configs** - Save `.moga-token.json` and `.prize-collection.json`
3. **Test on devnet first** - Always test before mainnet deployment
4. **Use hardware wallets for mainnet** - Ledger/Trezor recommended
5. **Verify program IDs** - Double-check addresses before deployment

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the generated config files (`.moga-token.json`, etc.)
3. Check Solana Explorer for transaction details
4. Review program logs: `solana logs`

---

## ✅ Deployment Checklist

- [ ] Install dependencies (`bun install`)
- [ ] Set up wallet and get SOL
- [ ] Run `1-deploy-moga-token.ts`
- [ ] Update `.env` with MOGA_MINT
- [ ] Run `2-create-prize-collection.ts`
- [ ] Update `.env` with PRIZE_COLLECTION_MINT
- [ ] Run `3-delegate-collection-authority.ts`
- [ ] Update program code with PRIZE_COLLECTION_MINT
- [ ] Build programs (`anchor build`)
- [ ] Deploy programs (`anchor deploy`)
- [ ] Test on devnet
- [ ] Deploy to mainnet (when ready)

---

**Happy deploying! 🚀**
