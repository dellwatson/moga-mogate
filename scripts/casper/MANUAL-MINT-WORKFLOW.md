# Manual Mint Workflow

## Current Status

Both contracts are deploying:

1. **PUBLIC CEP-95**

   - Deploy: `f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136`
   - Explorer: https://testnet.cspr.live/deploy/f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136

2. **Authority Mint (NO whitelist)**
   - Deploy: `bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965`
   - Explorer: https://testnet.cspr.live/deploy/bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965

## Option 1: Auto-Monitor (Recommended)

Run this script to automatically check every 30 seconds and run mints when ready:

```bash
chmod +x scripts/casper/auto-mint-when-ready.sh
./scripts/casper/auto-mint-when-ready.sh
```

This will:

- Check deployment status every 30 seconds
- Extract contract hashes when ready
- Update mint scripts automatically
- Run both direct mint and delegate mint
- Save proof files

## Option 2: Manual Steps

### Step 1: Check if contracts are deployed

```bash
./scripts/casper/extract-contract-hashes.sh
```

If you see "BOTH CONTRACTS DEPLOYED!", proceed to Step 2.
If still pending, wait 1-2 minutes and try again.

### Step 2: Verify contract hashes

```bash
cat deployment-casper/CONTRACT-HASHES.json
```

### Step 3: Run direct mint on PUBLIC CEP-95

```bash
node scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js
```

This will:

- Mint NFT #400 directly on PUBLIC CEP-95
- Save proof to `deployment-casper/PUBLIC-CEP95-MINT-PROOF.json`

### Step 4: Run delegate mint (Authority Mint → PUBLIC CEP-95)

```bash
node scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js
```

This will:

- Call Authority Mint's `mint_nft` function
- Authority Mint will mint NFT #401 on PUBLIC CEP-95
- Save proof to `deployment-casper/PUBLIC-CEP95-DELEGATE-MINT-PROOF.json`

## Expected Results

### Direct Mint

- Token ID: 400
- Recipient: Your account
- Contract: PUBLIC CEP-95
- Method: Direct `mint()` call

### Delegate Mint

- Token ID: 401
- Recipient: Your account
- Contract: PUBLIC CEP-95
- Method: Authority Mint's `mint_nft()` → PUBLIC CEP-95's `mint()`

## Verification

Check the proof files:

```bash
cat deployment-casper/PUBLIC-CEP95-MINT-PROOF.json
cat deployment-casper/PUBLIC-CEP95-DELEGATE-MINT-PROOF.json
```

Both should show `"status": "SUCCESS"` and include explorer links.

## Troubleshooting

### Contracts still pending after 10 minutes

- Check explorer links above
- Verify network is not congested
- May need to redeploy with higher gas price

### Mint fails with "Contract not found"

- Run extraction script again: `./scripts/casper/extract-contract-hashes.sh`
- Verify contract hashes in `deployment-casper/CONTRACT-HASHES.json`

### Delegate mint fails

- Ensure Authority Mint has no whitelist (it shouldn't based on deployment)
- Verify PUBLIC CEP-95 hash is correct in delegate mint script
- Check that Authority Mint can call PUBLIC CEP-95's mint function
