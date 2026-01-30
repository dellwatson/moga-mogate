# Minting Scripts

## For Backend/Node.js (Current Working Version)

Use `mint-authority.js` with tsx:

```bash
npx tsx scripts/mint-authority.js
```

This script directly imports the TS SDK and calls `client.mintAuthority()`.

## For Frontend (React/Vue/etc)

### Option 1: Use Aleo SDK Directly

```javascript
import { Account, ProgramManager, AleoNetworkClient } from "@provablehq/sdk";

async function mintNFT(privateKey, toAddress, uriHash) {
  const account = new Account({ privateKey });
  const networkClient = new AleoNetworkClient("https://api.provable.com/v2");
  const programManager = new ProgramManager(
    "https://api.provable.com/v2",
    new AleoKeyProvider(),
    new NetworkRecordProvider(account, networkClient),
  );

  programManager.setAccount(account);

  const tokenId = `${Date.now()}u64`;
  const result = await programManager.execute(
    "mogate_authority_mint_v2.aleo",
    "mint",
    0, // fee
    false, // not offline
    [toAddress, uriHash, tokenId],
  );

  return result;
}
```

### Option 2: Build TS SDK to JS Bundle

```bash
cd ts-sdk
bun build ./src/index.ts --outdir ./dist --target browser
```

Then import in your frontend:

```javascript
import { createClient } from "@moga/aleo-nft-sdk";

const client = createClient(privateKey);
await client.mintAuthority(toAddress, uriHash, tokenId);
```

## Deployed Contracts

- **Gateway V2**: `mogate_authority_mint_v2.aleo`
- **Collection V1**: `mogate_nft_collection_rwa.aleo`
- **Network**: Aleo Testnet
- **Endpoint**: `https://api.provable.com/v2`

## Parameters

- `toAddress`: Aleo address (e.g., `aleo1...`)
- `uriHash`: Metadata URI hash as field (e.g., `123456789field`)
- `tokenId`: Unix timestamp as u64 (e.g., `${Date.now()}u64`)
