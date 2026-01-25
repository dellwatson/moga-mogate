# Casper NFT Burn Validator

Validate NFT burn transactions and extract metadata + owner information from CEP-78 collections.

## Features

Given **only a burn transaction hash**, the validator can extract:

✅ **NFT Metadata URI** - The token's metadata JSON URL  
✅ **Last Owner Address** - Account hash of the owner before burn  
✅ **Token ID** - The burned token's identifier  
✅ **Collection Info** - Contract hash, name, symbol  
✅ **Burn Details** - Burner, timestamp, block hash  
✅ **Validation** - Verify the burn actually happened

## Quick Start

### Basic Usage

```typescript
import { testnetBurnValidator } from "./src/casper-nft-validator";

// Validate a burn transaction
const result = await testnetBurnValidator.validateBurn("abc123...");

if (result.valid) {
  console.log("Metadata URI:", result.data.nft.metadataUri);
  console.log("Last Owner:", result.data.nft.lastOwner);
  console.log("Token ID:", result.data.nft.tokenId);
}
```

### API Endpoint

```bash
# Validate a burn
curl -X POST http://localhost:3000/api/casper/validate-burn \
  -H "Content-Type: application/json" \
  -d '{
    "burnTxHash": "abc123...",
    "network": "testnet"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deployHash": "abc123...",
    "collection": {
      "contractHash": "376fb8f9264fd7cf...",
      "name": "Tixia Credits 1/1",
      "symbol": "TIX1O1"
    },
    "nft": {
      "tokenId": "42",
      "metadataUri": "https://raw.githubusercontent.com/.../metadata.json",
      "lastOwner": "account-hash-1877cb2417eb4f7f...",
      "burnedAt": "2026-01-02T10:30:00Z"
    },
    "burner": "account-hash-1877cb2417eb4f7f...",
    "timestamp": "2026-01-02T10:30:00Z"
  }
}
```

## How It Works

1. **Fetch Deploy** - Get the burn transaction from Casper RPC
2. **Verify Execution** - Check the deploy executed successfully
3. **Extract Entry Point** - Confirm it's a `burn` call
4. **Parse Events** - Extract CEP-78 Burn event from transforms
5. **Get Token Data** - Extract token ID from event/args
6. **Query Metadata** - Fetch metadata URI from contract state
7. **Identify Owner** - Extract last owner (burner must have owned it)
8. **Return Result** - Structured validation result

## API Reference

### `CasperNFTBurnValidator`

#### Constructor

```typescript
new CasperNFTBurnValidator(nodeAddress: string, chainName?: string)
```

#### Methods

##### `validateBurn(burnTxHash: string)`

Validate a burn transaction and extract all NFT data.

**Returns:** `BurnValidationResult`

```typescript
{
  valid: boolean;
  error?: string;
  data?: {
    deployHash: string;
    blockHash: string;
    timestamp: string;
    burner: string;
    collection: {
      contractHash: string;
      contractPackageHash: string;
      name?: string;
      symbol?: string;
    };
    nft: {
      tokenId: string;
      metadataUri: string;
      lastOwner: string;
      burnedAt: string;
    };
  };
}
```

##### `validateBurns(burnTxHashes: string[])`

Batch validate multiple burns.

**Returns:** `BurnValidationResult[]`

##### `isBurnTransaction(deployHash: string)`

Quick check if a deploy is a burn (lightweight).

**Returns:** `boolean`

## REST API Endpoints

### `POST /api/casper/validate-burn`

Validate a single burn transaction.

**Body:**

```json
{
  "burnTxHash": "abc123...",
  "network": "testnet"
}
```

### `POST /api/casper/validate-burns`

Batch validate up to 100 burns.

**Body:**

```json
{
  "burnTxHashes": ["abc123...", "def456..."],
  "network": "testnet"
}
```

### `GET /api/casper/burn/:hash`

Get burn details by hash.

**Query:** `?network=testnet`

### `POST /api/casper/check-burn`

Quick check if deploy is a burn.

**Body:**

```json
{
  "deployHash": "abc123...",
  "network": "testnet"
}
```

## Use Cases

### 1. Raffle Entry Validation

```typescript
async function validateRaffleEntry(burnTxHash: string) {
  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (!result.valid) {
    throw new Error("Invalid burn");
  }

  // Check collection
  if (result.data.collection.contractHash !== EXPECTED_COLLECTION) {
    throw new Error("Wrong collection");
  }

  // Check burn is recent
  const burnTime = new Date(result.data.nft.burnedAt).getTime();
  if (Date.now() - burnTime > 24 * 60 * 60 * 1000) {
    throw new Error("Burn too old");
  }

  return {
    owner: result.data.nft.lastOwner,
    tokenId: result.data.nft.tokenId,
  };
}
```

### 2. Faucet Credit Validation

```typescript
async function validateBurnForCredit(burnTxHash: string) {
  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (!result.valid) {
    throw new Error("Invalid burn");
  }

  // Fetch metadata to get credit value
  const metadataResponse = await fetch(result.data.nft.metadataUri);
  const metadata = await metadataResponse.json();

  const creditValue = metadata.attributes.find(
    (attr: any) => attr.trait_type === "value"
  )?.value;

  return {
    owner: result.data.nft.lastOwner,
    creditValue,
    metadataUri: result.data.nft.metadataUri,
  };
}
```

### 3. Database Storage

```typescript
async function storeBurnInDB(burnTxHash: string, db: any) {
  const result = await testnetBurnValidator.validateBurn(burnTxHash);

  if (!result.valid) {
    throw new Error("Invalid burn");
  }

  await db.burns.create({
    deployHash: result.data.deployHash,
    tokenId: result.data.nft.tokenId,
    metadataUri: result.data.nft.metadataUri,
    lastOwner: result.data.nft.lastOwner,
    burner: result.data.burner,
    collectionHash: result.data.collection.contractHash,
    burnedAt: new Date(result.data.nft.burnedAt),
  });
}
```

## Error Handling

The validator returns structured errors:

```typescript
{
  valid: false,
  error: "Deploy not found"
}

{
  valid: false,
  error: "Deploy not executed yet"
}

{
  valid: false,
  error: "Not a burn transaction. Entry point: transfer"
}

{
  valid: false,
  error: "No burn event found in transaction"
}
```

## Integration with Express

```typescript
import express from "express";
import { setupBurnValidatorRoutes } from "./src/api-burn-validator";

const app = express();
app.use(express.json());

// Setup routes
setupBurnValidatorRoutes(app);

app.listen(3000, () => {
  console.log("Burn validator API running on port 3000");
});
```

## Files

- **`casper-nft-validator.ts`** - Main validator class
- **`casper-nft-validator.example.ts`** - Usage examples
- **`api-burn-validator.ts`** - REST API endpoints

## Notes

- Works with **CEP-78 standard** NFT collections
- Supports both **testnet** and **mainnet**
- Extracts data from **deploy transforms** and **contract state**
- **No indexer required** - queries RPC directly
- Handles **1/1 NFTs** and **SFTs**

## Deployed Collections

### Testnet

- **Tixia 1/1:** `376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97`
- **Tixia SFT:** `e3699ea7bbbcc74018b0c24d3557c6cfd34b9c30405cf4cf4bae3dfc589ccea0`

---

**Given just a burn tx hash, you get everything you need!**
