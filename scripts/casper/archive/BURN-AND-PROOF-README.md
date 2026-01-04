# 🔥 NFT BURN & PROOF WORKFLOW

## Overview

Burn NFTs on Casper CEP-95 contracts and generate verifiable burn proofs.

## Scripts

### 1. `get-nft-metadata.js` - Get metadata BEFORE burning

```bash
node scripts/casper/get-nft-metadata.js <contract-hash> <token-id>
```

**Purpose**: Retrieve NFT metadata before burning (metadata is deleted during burn)

### 2. `burn-nft-cep95.js` - Burn the NFT

```bash
node scripts/casper/burn-nft-cep95.js <contract-hash> <token-id>
```

**Purpose**:

- Calls `burn(token_id)` on the CEP-95 contract
- Only token owner can burn
- Generates burn transaction proof

### 3. `analyze-burn-proof.js` - Analyze burn transaction

```bash
node scripts/casper/analyze-burn-proof.js <burn-deploy-hash>
```

**Purpose**:

- Extracts burn proof details
- Shows burner, contract, token ID
- Generates JSON proof file
- Provides explorer link

## Complete Workflow

### Step 1: Get Metadata (Optional but recommended)

```bash
# Save metadata before burning
node scripts/casper/get-nft-metadata.js hash-abc123... 1 > metadata-token-1.json
```

### Step 2: Burn NFT

```bash
# Burn token ID 1 from Public CEP-95
node scripts/casper/burn-nft-cep95.js hash-abc123... 1
```

Output:

```
✅ NFT BURNED SUCCESSFULLY!

📊 Burn Proof:
   Deploy Hash: def456...
   Block Hash: 789ghi...
   Contract: hash-abc123...
   Token ID: 1
   Burner: 020363fc...
```

### Step 3: Analyze Burn Proof

```bash
# Get detailed burn proof
node scripts/casper/analyze-burn-proof.js def456...
```

Output:

```
📋 BURN TRANSACTION DETAILS
============================================================

🔹 Transaction Info:
   Deploy Hash: def456...
   Block Hash: 789ghi...
   Timestamp: 2026-01-03T14:00:00Z

🔹 Burner:
   Public Key: 020363fc...
   Account Hash: account-hash-1877cb...

🔹 Contract Call:
   Contract: hash-abc123...
   Entrypoint: burn
   Token ID: 1

✅ Execution: SUCCESS
   Cost: 2500000000

💾 Burn Proof saved to: burn-proof-def456.json
```

## Burn Proof JSON Format

```json
{
  "deployHash": "def456...",
  "blockHash": "789ghi...",
  "timestamp": "2026-01-03T14:00:00Z",
  "burner": {
    "publicKey": "020363fc...",
    "accountHash": "account-hash-1877cb..."
  },
  "contract": "hash-abc123...",
  "tokenId": "1",
  "entrypoint": "burn",
  "success": true,
  "cost": 2500000000,
  "network": "casper-test",
  "nodeUrl": "http://65.109.83.79:7777"
}
```

## Key Differences from Solana

| Aspect                  | Solana (Metaplex)          | Casper (CEP-95)                   |
| ----------------------- | -------------------------- | --------------------------------- |
| **Burn Location**       | Metaplex program           | Collection contract               |
| **Who Can Burn**        | Token owner + authority    | Token owner only (default)        |
| **Metadata After Burn** | Remains on-chain           | Deleted from contract             |
| **Proof**               | Transaction signature      | Deploy hash + execution result    |
| **Verification**        | Check token account closed | Check contract state + transforms |

## Important Notes

### 1. **Metadata is Deleted**

Unlike Solana where metadata accounts persist, Casper CEP-95 **deletes metadata** during burn.
**Solution**: Query and save metadata BEFORE burning!

### 2. **Only Owner Can Burn**

The `burn()` function in CEP-95 checks:

```rust
let owner = self.token.owner_of(token_id);
let caller = self.env().caller();
if Some(caller) == owner {
    self.token.raw_burn(token_id);
}
```

### 3. **Burn Proof is On-Chain**

The burn transaction is permanently recorded on Casper blockchain:

- Deploy hash
- Block hash
- Execution result
- State transforms

### 4. **Verification**

To verify a burn:

1. Check deploy hash exists and succeeded
2. Verify entrypoint was "burn"
3. Verify token no longer exists in contract state
4. Check transforms show metadata removal

## Example: Complete Burn Flow

```bash
# 1. Check you own the token
node scripts/casper/get-nft-metadata.js hash-abc123... 1

# 2. Save metadata
node scripts/casper/get-nft-metadata.js hash-abc123... 1 > token-1-metadata.json

# 3. Burn the token
node scripts/casper/burn-nft-cep95.js hash-abc123... 1

# 4. Get burn proof
node scripts/casper/analyze-burn-proof.js <deploy-hash-from-step-3>

# 5. Verify on explorer
# Open: https://testnet.cspr.live/deploy/<deploy-hash>
```

## Use Cases

1. **Proof of Burn for Airdrops** - Burn old NFT to claim new one
2. **Deflationary Mechanics** - Reduce supply
3. **Upgrade Mechanisms** - Burn v1 to mint v2
4. **Redemption** - Burn NFT for physical goods
5. **Compliance** - Prove token destruction

## Next Steps

After burning, you can:

- Submit burn proof to your backend
- Trigger airdrop/reward based on burn
- Update off-chain records
- Display burn history in UI
