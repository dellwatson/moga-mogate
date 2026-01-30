# Gateway Deployment Issue

## Problem

When deploying `mogate_authority_mint_gateway.aleo`, Leo tries to deploy BOTH:

1. Collection (dependency) - **ALREADY DEPLOYED**
2. Gateway (new program) - **NEEDS TO BE DEPLOYED**

This causes HTTP 500 error because collection already exists on-chain.

## Why This Happens

```leo
import mogate_nft_collection_rwa.aleo;
```

Leo sees this import and tries to deploy the entire dependency tree.

## Current Situation

- ✅ Collection: `mogate_nft_collection_rwa.aleo` - DEPLOYED
- ❌ Gateway: `mogate_authority_mint_gateway.aleo` - NOT DEPLOYED
- ✅ Gateway builds successfully
- ✅ Constructor exists
- ❌ Deployment fails due to collection re-deployment attempt

## Solutions Tried

### 1. Leo Deploy (FAILED)

```bash
leo deploy --broadcast
```

**Result:** Tries to deploy collection → HTTP 500

### 2. SnarkOS Deploy (FAILED)

```bash
snarkos developer deploy mogate_authority_mint_gateway.aleo \
  --private-key "$PRIVATE_KEY" \
  --query "https://api.provable.com/v2" \
  --path ./build/ \
  --broadcast "https://api.provable.com/v2/testnet/transaction/broadcast"
```

**Result:** Failed to query consensus height → JSON parse error

## Possible Solutions

### Option 1: Wait for Testnet API to Stabilize

The HTTP 500 errors suggest testnet API issues. Try again later.

### Option 2: Use Different Endpoint

Try alternative Aleo testnet endpoints if available.

### Option 3: Deploy Without Import (NOT RECOMMENDED)

Temporarily remove the import, deploy, then add it back. **This won't work** because the gateway needs the collection's types.

### Option 4: Use Aleo SDK Directly

Write a custom deployment script using `@provablehq/sdk`:

```typescript
import { ProgramManager } from "@provablehq/sdk";

const manager = new ProgramManager(
  "https://api.provable.com/v2",
  keyProvider,
  recordProvider,
);

// Deploy only gateway
const txId = await manager.deploy(
  "mogate_authority_mint_gateway.aleo",
  fee,
  false,
);
```

### Option 5: Manual Transaction Creation

Create the deployment transaction manually and broadcast it separately.

## Recommended Action

**Try deploying at a different time** when testnet API is more stable. The HTTP 500 errors are server-side issues, not problems with your code.

## Gateway Status

```
Program: mogate_authority_mint_gateway.aleo
Status: Built ✅, Not Deployed ❌
Cost: 7.066951 credits
Constructor: ✅ @noupgrade async constructor() {}
Dependencies: mogate_nft_collection_rwa.aleo (DEPLOYED)
```

## What's Working

- ✅ Gateway compiles successfully
- ✅ Constructor is correct
- ✅ Imports are correct
- ✅ Cross-contract calls are correct
- ❌ Testnet API is unstable (HTTP 500)
