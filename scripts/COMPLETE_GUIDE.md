# 🚀 Complete Deployment Guide - All Scripts

## 📋 Overview

This guide covers **all 8 deployment scripts** for the Mogate RWA Raffle platform.

---

## 🎯 Your Questions Answered

### 1. **Prize Collection NFT - Dynamic per Organizer**

**Yes!** The collection NFT is dynamic:

- **Platform Collection** (Script 2): Default collection for platform-owned prizes
- **Organizer's Collection**: Organizers can use their own NFT collections
- **When creating raffle**: Organizer passes `prizeCollectionMint` (dynamic!)

```typescript
// Organizer can use platform collection OR their own
await sdk.createRaffle({
  prizeCollectionMint: organizerCollectionMint, // ← Dynamic!
  // ...
});
```

### 2. **MRFT (MOGA Raffle Free Ticket)**

**Created!** Script 4 & 5 handle MRFT:

- **Script 4**: Creates MRFT collection NFT
- **Script 5**: Delegates MRFT authority to raffle program
- **Purpose**: Refund tickets when raffles fail (alternative to USDC refunds)

### 3. **USDC/Stablecoins**

**Created!** Script 6 handles stablecoins:

- **Mainnet**: Uses existing USDC, USDT, DAI, PYUSD
- **Devnet**: Uses devnet USDC or creates test stablecoin
- **Dynamic**: Organizers choose which stablecoin when creating raffles

### 4. **Program Deployment**

**Created!** Script 7 & 8 handle programs:

- **Script 7**: Builds and deploys all programs
- **Script 8**: Tests deployed programs with ts-sdk

---

## 📦 All 8 Scripts

### Script 1: Deploy MOGA Token
```bash
bun run deploy:moga
```
**Creates:** MOGA SPL token (9 decimals, 1B supply)  
**Output:** `.moga-token.json`

---

### Script 2: Create Prize Collection
```bash
bun run deploy:prize-collection
```
**Creates:** "Mogate RWA Prizes" collection NFT  
**Output:** `.prize-collection.json`

---

### Script 3: Delegate Prize Collection Authority
```bash
bun run deploy:delegate-prize
```
**Delegates:** Prize collection authority to programs  
**Output:** `.collection-delegations.json`

---

### Script 4: Create MRFT Collection
```bash
bun run deploy:mrft-collection
```
**Creates:** "Mogate Raffle Free Ticket" collection NFT  
**Output:** `.mrft-collection.json`

---

### Script 5: Delegate MRFT Authority
```bash
bun run deploy:delegate-mrft
```
**Delegates:** MRFT collection authority to raffle program  
**Output:** `.mrft-delegation.json`

---

### Script 6: Setup Stablecoins
```bash
bun run deploy:stablecoins
```
**Sets up:** USDC/USDT/DAI addresses or creates test stablecoin  
**Output:** `.stablecoins.json`

---

### Script 7: Deploy Programs
```bash
bun run deploy:programs
```
**Deploys:** All Solana programs (rwa_raffle, direct_sell, rwa_redeem)  
**Output:** `.programs-devnet.json` or `.programs-mainnet.json`

---

### Script 8: Test Programs
```bash
bun run test:programs
```
**Tests:** Deployed programs with ts-sdk  
**Output:** Test results and integration guide

---

## 🔄 Complete Deployment Flow

```bash
# 1. Install dependencies
bun install

# 2. Get devnet SOL
solana config set --url devnet
solana airdrop 2

# 3. Deploy all tokens and collections
bun run deploy:all

# This runs:
# - Script 1: Deploy MOGA token
# - Script 2: Create prize collection
# - Script 3: Delegate prize authority
# - Script 4: Create MRFT collection
# - Script 5: Delegate MRFT authority
# - Script 6: Setup stablecoins

# 4. Update program code with collection mints
# (Scripts will tell you what to add)

# 5. Build programs
bun run build:programs

# 6. Deploy programs
bun run deploy:programs

# 7. Test everything
bun run test:programs
```

---

## 📁 Generated Files

After running all scripts:

```
.moga-token.json              # MOGA token config
.prize-collection.json        # Prize collection NFT config
.collection-delegations.json  # Prize authority delegations
.mrft-collection.json         # MRFT collection NFT config
.mrft-delegation.json         # MRFT authority delegation
.stablecoins.json             # Stablecoin addresses
.programs-devnet.json         # Deployed program IDs (devnet)
.programs-mainnet.json        # Deployed program IDs (mainnet)
```

---

## 🎯 What Each Component Does

### MOGA Token
- **Purpose:** Platform utility token
- **Usage:** Users pay with MOGA to buy raffle tickets
- **Swap:** MOGA → USDC via Jupiter (on-chain)

### Prize Collection NFT
- **Purpose:** Parent collection for all prize NFTs
- **Usage:** Prizes minted when winners claim
- **Dynamic:** Organizers can use their own collections

### MRFT Collection NFT
- **Purpose:** Refund tickets for failed raffles
- **Usage:** Alternative to USDC refunds
- **Benefit:** Better user retention ("store credit")

### Stablecoins (USDC/USDT/DAI)
- **Purpose:** Payment currency for raffles
- **Usage:** MOGA swapped to stablecoin, organizer receives stablecoin
- **Dynamic:** Organizers choose which stablecoin

### Programs
- **rwa_raffle:** Main raffle program
- **direct_sell:** Direct NFT sales
- **rwa_redeem:** RWA redemption

---

## 🔧 NPM Scripts Reference

```json
{
  "deploy:moga": "Deploy MOGA token",
  "deploy:prize-collection": "Create prize collection NFT",
  "deploy:delegate-prize": "Delegate prize authority",
  "deploy:mrft-collection": "Create MRFT collection NFT",
  "deploy:delegate-mrft": "Delegate MRFT authority",
  "deploy:stablecoins": "Setup stablecoins",
  "deploy:programs": "Deploy Solana programs",
  "deploy:all": "Run all deployment scripts",
  "test:programs": "Test deployed programs",
  "build:programs": "Build all programs",
  "build:raffle": "Build raffle program only",
  "build:direct-sell": "Build direct_sell program only",
  "build:redeem": "Build rwa_redeem program only"
}
```

---

## 🌐 Network Support

### Devnet (Testing)
```bash
export SOLANA_NETWORK=devnet
export SOLANA_RPC_URL=https://api.devnet.solana.com

bun run deploy:all
bun run deploy:programs
```

### Mainnet (Production)
```bash
export SOLANA_NETWORK=mainnet
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# ⚠️ Test thoroughly on devnet first!
bun run deploy:all
bun run deploy:programs
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Installed Bun and dependencies
- [ ] Set up wallet with SOL
- [ ] Configured network (devnet/mainnet)

### Token & Collection Deployment
- [ ] Deployed MOGA token (Script 1)
- [ ] Created prize collection (Script 2)
- [ ] Delegated prize authority (Script 3)
- [ ] Created MRFT collection (Script 4)
- [ ] Delegated MRFT authority (Script 5)
- [ ] Setup stablecoins (Script 6)

### Program Deployment
- [ ] Updated program code with collection mints
- [ ] Built programs successfully
- [ ] Deployed programs (Script 7)
- [ ] Updated Anchor.toml with program IDs
- [ ] Updated .env with all addresses

### Testing
- [ ] Ran test script (Script 8)
- [ ] Created test raffle
- [ ] Bought tickets with MOGA
- [ ] Drew winner
- [ ] Claimed prize NFT
- [ ] Tested USDC refund
- [ ] Tested MRFT refund
- [ ] Verified all features work

---

## 🚨 Common Issues

### "Insufficient balance"
```bash
# Devnet
solana airdrop 2

# Mainnet
# Transfer SOL to wallet
```

### "Config file not found"
```bash
# Run deployment scripts in order
bun run deploy:all
```

### "Program deployment failed"
```bash
# Check program size
ls -lh target/deploy/*.so

# Optimize build
cargo build-sbf --release
```

### "Collection already exists"
```bash
# Delete config and recreate
rm .prize-collection.json
bun run deploy:prize-collection
```

---

## 📚 Documentation

- **`scripts/README.md`** - Detailed script documentation
- **`DEPLOYMENT_GUIDE.md`** - Complete deployment guide
- **`docs/COLLECTION_NFT_EXPLAINED.md`** - Collection NFT details
- **`docs/COLLECTION_FLOW_DIAGRAM.md`** - Visual flow diagrams

---

## 🎉 Success!

After completing all scripts, you'll have:

- ✅ MOGA token deployed
- ✅ Prize collection NFT created and delegated
- ✅ MRFT collection NFT created and delegated
- ✅ Stablecoins configured
- ✅ All programs deployed and tested
- ✅ Full raffle platform operational

**Next steps:**
1. Build your frontend
2. Integrate with ts-sdk
3. Test with real users
4. Deploy to mainnet

**Happy building! 🚀**
