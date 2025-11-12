# 📝 Deployment Scripts Summary

## What I Created for You

I've created **3 deployment scripts** in the `scripts/` folder to guide you through the complete setup:

### 1️⃣ `1-deploy-moga-token.ts`
**Purpose:** Deploy the MOGA SPL token

**What it does:**
- Creates MOGA token mint (9 decimals)
- Mints initial supply (1 billion MOGA)
- Creates your token account
- Saves config to `.moga-token.json`

**Run:**
```bash
bun run scripts/1-deploy-moga-token.ts
```

**Output:**
```
MOGA Mint: MogaM1nt111111111111111111111111111111111
```

---

### 2️⃣ `2-create-prize-collection.ts`
**Purpose:** Create the prize collection NFT

**What it does:**
- Uploads metadata to Arweave
- Creates collection NFT "Mogate RWA Prizes"
- Sets you as update authority
- Saves config to `.prize-collection.json`

**Run:**
```bash
bun run scripts/2-create-prize-collection.ts
```

**Output:**
```
Collection Mint: CoLLect1oN1111111111111111111111111111111
```

---

### 3️⃣ `3-delegate-collection-authority.ts`
**Purpose:** Delegate collection authority to your programs

**What it does:**
- Derives collection authority PDAs
- Delegates verification rights to programs
- Verifies delegations
- Saves config to `.collection-delegations.json`

**Run:**
```bash
bun run scripts/3-delegate-collection-authority.ts
```

**Output:**
```
rwa_raffle PDA: Auth0r1tyPDA111111111111111111111111111
direct_sell PDA: Auth0r1tyPDA222222222222222222222222222
```

---

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Get devnet SOL
solana config set --url devnet
solana airdrop 2

# Run all deployment scripts
bun run deploy:all

# Update program code with collection mint
# (Script will tell you what to add)

# Build and deploy programs
anchor build
anchor deploy
```

---

## 📁 What Gets Created

After running the scripts:

```
.moga-token.json              # MOGA token configuration
.prize-collection.json        # Prize collection NFT configuration
.collection-delegations.json  # Collection authority delegations
```

**These files contain important deployment info - back them up!**

---

## 🔄 Complete Flow

```
Step 1: Deploy MOGA Token
  ↓
  MOGA_MINT address
  ↓
Step 2: Create Prize Collection
  ↓
  PRIZE_COLLECTION_MINT address
  ↓
Step 3: Delegate Collection Authority
  ↓
  Collection Authority PDAs
  ↓
Step 4: Update Program Code
  ↓
  Add PRIZE_COLLECTION_MINT constant
  ↓
Step 5: Build & Deploy Programs
  ↓
  ✅ Platform Ready!
```

---

## 📖 Documentation

- **`scripts/README.md`** - Detailed script documentation
- **`DEPLOYMENT_GUIDE.md`** - Complete deployment guide
- **`docs/COLLECTION_NFT_EXPLAINED.md`** - Collection NFT explanation
- **`docs/COLLECTION_FLOW_DIAGRAM.md`** - Visual flow diagrams

---

## ✅ Why This Approach?

### Before (Confusing ❌)
- No clear deployment process
- Manual Metaplex CLI commands
- Unclear where to get collection mint
- Hard to track what's deployed

### After (Clear ✅)
- Step-by-step scripts
- Automatic config saving
- Clear output with next steps
- Easy to reproduce deployment

---

## 🎯 Key Points

1. **Scripts vs TS-SDK**
   - `scripts/` = Deployment tools (run once)
   - `ts-sdk/` = Client library (used by your app)

2. **One-time Setup**
   - MOGA token: Deploy once per network
   - Prize collection: Create once per network
   - Collection delegation: Run once per network

3. **Per-Raffle Config**
   - Organizers pass `prize_collection_mint` when creating raffles
   - Organizers choose `refund_mode` (USDC/MRFT/both)
   - Organizers choose stable coin (USDC/USDT/DAI)

4. **No Hardcoding**
   - Everything is dynamic
   - Configs saved to JSON files
   - Easy to switch networks (devnet/mainnet)

---

## 🔧 NPM Scripts Added

I've added these to `package.json`:

```json
{
  "scripts": {
    "deploy:moga": "bun run scripts/1-deploy-moga-token.ts",
    "deploy:collection": "bun run scripts/2-create-prize-collection.ts",
    "deploy:delegate": "bun run scripts/3-delegate-collection-authority.ts",
    "deploy:all": "bun run deploy:moga && bun run deploy:collection && bun run deploy:delegate"
  }
}
```

---

## 🚨 Important Notes

1. **Backup Config Files**
   ```bash
   cp .moga-token.json ~/backups/
   cp .prize-collection.json ~/backups/
   cp .collection-delegations.json ~/backups/
   ```

2. **Test on Devnet First**
   - Always test on devnet before mainnet
   - Devnet SOL is free
   - No risk of losing real money

3. **Update Program Code**
   - Scripts will tell you what to add
   - Don't forget to rebuild programs after updating

4. **Network Switching**
   ```bash
   # Devnet
   export SOLANA_NETWORK=devnet
   
   # Mainnet
   export SOLANA_NETWORK=mainnet
   ```

---

## 📞 Next Steps

1. **Read the guides**
   - `scripts/README.md` - Script details
   - `DEPLOYMENT_GUIDE.md` - Full deployment process

2. **Run the scripts**
   ```bash
   bun run deploy:all
   ```

3. **Update your program**
   - Add `PRIZE_COLLECTION_MINT` constant
   - Rebuild programs

4. **Deploy programs**
   ```bash
   anchor build
   anchor deploy
   ```

5. **Test everything**
   - Create test raffle
   - Buy tickets
   - Draw winner
   - Claim prize

---

**You now have a complete, guided deployment process! 🎉**
