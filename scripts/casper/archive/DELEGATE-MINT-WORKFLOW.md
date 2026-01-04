# 🎯 DELEGATE MINT WORKFLOW

## Overview

Authority Mint contract will call Public CEP-95's mint function via cross-contract call.

## Prerequisites

1. ✅ Authority Mint deployed: `hash-b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc`
2. ⏳ Public CEP-95 deployed: `fa2e3339848f555f6d6261b3c53eebd2bfea3074ca38bd491eda882b3397be88` (pending)

## Steps

### Step 1: Wait for Public CEP-95 Deployment

```bash
casper-client get-deploy \
  --node-address http://65.109.83.79:7777 \
  fa2e3339848f555f6d6261b3c53eebd2bfea3074ca38bd491eda882b3397be88
```

Look for the contract hash in the transforms section.

### Step 2: Whitelist Public CEP-95 in Authority Mint

```bash
node scripts/casper/whitelist-authority-mint.js <PUBLIC_CEP95_HASH>
```

This calls `allow_collection(collection: Address)` on Authority Mint.

### Step 3: Delegate Mint via Authority Mint

```bash
# Update PUBLIC_CEP95_HASH in delegate-mint-public-cep95.js first
node scripts/casper/delegate-mint-public-cep95.js
```

This calls `mint_for_collection(collection, to, token_id, metadata)` on Authority Mint,
which then calls `mint(to, token_id, metadata)` on Public CEP-95.

## Flow Diagram

```
Your Account
    |
    | (1) allow_collection(public_cep95_address)
    v
Authority Mint Contract
    |
    | (2) mint_for_collection(public_cep95, recipient, token_id, metadata)
    v
Authority Mint Contract
    |
    | (3) CROSS-CONTRACT CALL: mint(recipient, token_id, metadata)
    v
Public CEP-95 Contract
    |
    | (4) raw_mint() - NO OWNER CHECK!
    v
NFT Minted! ✅
```

## Key Points

1. **Authority Mint acts as delegated minter** - Like Solana's mint authority
2. **Public CEP-95 has no owner check** - Anyone can call mint()
3. **Cross-contract call** - Authority Mint calls Public CEP-95's mint function
4. **All via JS-SDK** - No CLI, no session WASM for minting!

## Expected Results

- ✅ Whitelist succeeds
- ✅ Delegate mint succeeds
- ✅ NFT appears in recipient's balance
- ✅ Proves cross-contract delegation works!
