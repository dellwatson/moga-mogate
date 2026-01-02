# Casper Authority Mint SDK

TypeScript SDK for minting NFTs via the Authority Mint contract on Casper testnet.

## Installation

```bash
bun add casper-js-sdk
```

## Quick Start

### Backend Minting (with private key)

```typescript
import {
  CasperAuthorityMintClient,
  TIXIA_1O1_COLLECTION_HASH,
} from "./src/casper-authority-mint";
import { Keys } from "casper-js-sdk";

// Load keys
const keys = Keys.Ed25519.parseKeyFiles("./public_key.pem", "./secret_key.pem");

// Create client
const client = new CasperAuthorityMintClient();

// Mint NFT
const deployHash = await client.mintNFT(
  {
    collectionHash: TIXIA_1O1_COLLECTION_HASH,
    recipientAccountHash:
      "1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8",
    metadata: {
      name: "Tixia $100 Flight Credit",
      token_uri:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/100/metadata.json",
    },
  },
  keys
);

console.log("Deploy:", `https://testnet.cspr.live/deploy/${deployHash}`);
```

### Frontend Minting (with Casper Wallet)

```typescript
import {
  CasperAuthorityMintClient,
  TIXIA_1O1_COLLECTION_HASH,
} from "./src/casper-authority-mint";
import { CLPublicKey, DeployUtil } from "casper-js-sdk";

// Connect wallet
const casperWallet = window.casperlabsHelper;
await casperWallet.requestConnection();
const publicKeyHex = await casperWallet.getActivePublicKey();
const publicKey = CLPublicKey.fromHex(publicKeyHex);

// Get account hash
const accountHash = publicKey.toAccountHashStr().replace("account-hash-", "");

// Build deploy
const client = new CasperAuthorityMintClient();
const deploy = client.buildMintNFTDeploy(
  {
    collectionHash: TIXIA_1O1_COLLECTION_HASH,
    recipientAccountHash: accountHash,
    metadata: {
      name: "Tixia $50 Hotel Credit",
      token_uri:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/50/metadata.json",
    },
  },
  publicKey
);

// Sign with wallet
const signedDeployJson = await casperWallet.sign(
  JSON.stringify(DeployUtil.deployToJson(deploy)),
  publicKeyHex
);
const signedDeploy = DeployUtil.deployFromJson(
  JSON.parse(signedDeployJson)
).unwrap();

// Send
const deployHash = await client.sendDeploy(signedDeploy);
```

## Contract Parameters

The `mint_nft` entrypoint accepts these parameters:

| Parameter         | Type            | Description                                              |
| ----------------- | --------------- | -------------------------------------------------------- |
| `collection_hash` | `ByteArray(32)` | CEP-78 collection contract hash (64-char hex, no prefix) |
| `token_owner`     | `Key`           | Recipient account hash (64-char hex, no prefix)          |
| `token_meta_data` | `String`        | JSON string with `name` and `token_uri`                  |

### Example Parameters

```typescript
{
  collection_hash: '376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97',
  token_owner: '1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8',
  token_meta_data: '{"name":"Tixia $100 Flight Credit","token_uri":"https://raw.githubusercontent.com/..."}'
}
```

## Collections

### Tixia 1/1 Collection

- **Hash:** `376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97`
- **Supply:** 1,000 tokens
- **Type:** Unique NFTs

### Tixia SFT Collection

- **Hash:** `e3699ea7bbbcc74018b0c24d3557c6cfd34b9c30405cf4cf4bae3dfc589ccea0`
- **Supply:** 10,000 tokens
- **Type:** Semi-Fungible Tokens

## API Reference

### `CasperAuthorityMintClient`

#### Constructor

```typescript
new CasperAuthorityMintClient(nodeAddress?: string, chainName?: string)
```

#### Methods

##### `mintNFT(params, signerKeys)`

Mint an NFT (backend use with private key).

**Parameters:**

- `params.collectionHash`: Collection contract hash (64-char hex)
- `params.recipientAccountHash`: Recipient account hash (64-char hex)
- `params.metadata`: `{ name: string, token_uri: string }`
- `params.paymentAmount`: Gas in motes (default: 5_000_000_000)
- `signerKeys`: Casper key pair

**Returns:** Deploy hash

##### `buildMintNFTDeploy(params, publicKey)`

Build unsigned deploy for wallet signing (frontend use).

**Returns:** Unsigned `Deploy` object

##### `sendDeploy(signedDeploy)`

Send a signed deploy.

**Returns:** Deploy hash

##### `waitForDeploy(deployHash, timeoutMs?)`

Wait for deploy execution.

**Returns:** Execution result

## Helper Functions

### `stripAccountHashPrefix(accountHash)`

Remove `account-hash-` prefix from account hash.

### `stripContractHashPrefix(contractHash)`

Remove `contract-` prefix from contract hash.

## Examples

See `src/casper-authority-mint.example.ts` for:

- Backend minting
- Frontend wallet integration
- Batch minting
- SFT minting

## Gas Costs

- **Mint NFT:** ~5 CSPR (5,000,000,000 motes)
- **Allow collection:** ~3 CSPR (3,000,000,000 motes)

## Contract Info

- **Authority Mint:** `contract-b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc`
- **Network:** Casper testnet
- **RPC:** http://65.109.83.79:7777
- **Chain:** casper-test

## Notes

- **NOT using cspr.click** - This SDK uses `casper-js-sdk` (official Casper SDK)
- **cspr.click** is for wallet UI integration, not contract calls
- All hashes must be **64-char hex without prefixes** (`contract-`, `account-hash-`)
- Metadata must be valid JSON string with `name` and `token_uri` fields
