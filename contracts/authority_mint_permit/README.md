# Authority Mint Permit Contract

Native Casper contract for NFT minting with **signed permit system**.

## Features

✅ **Permit-based minting** - Users get signed permits from backend  
✅ **Nonce tracking** - Prevents permit replay attacks  
✅ **Expiry validation** - Permits expire after set time  
✅ **Signature verification** - Blake2b-512 + Ed25519 signatures  
✅ **Collection whitelisting** - Only allowed collections can be minted  
✅ **Backward compatible** - Still supports direct `mint_nft` calls

## How It Works

### 1. Backend Signs Permit

```typescript
import { CasperPermitSigner } from "./ts-sdk/src/casper-permit-signer";

const signer = new CasperPermitSigner(authorityKeys);

const permit = signer.createMintPermit(
  collectionHash,
  recipientAccountHash,
  { name: "NFT Name", token_uri: "https://..." },
  3600 // valid for 1 hour
);

// Returns:
// {
//   collection_hash: "...",
//   token_owner: "account-hash-...",
//   token_metadata: "{...}",
//   nonce: "unique-string",
//   expiry: 1234567890,
//   signature: "abc123..."
// }
```

### 2. Frontend Mints with Permit

```typescript
import {
  CasperClient,
  DeployUtil,
  RuntimeArgs,
  CLValueBuilder,
} from "casper-js-sdk";

const deploy = DeployUtil.makeDeploy(
  new DeployUtil.DeployParams(userPublicKey, "casper-test"),
  DeployUtil.ExecutableDeployItem.newStoredContractByHash(
    Buffer.from(authorityMintHash, "hex"),
    "mint_nft_with_permit",
    RuntimeArgs.fromMap({
      collection_hash: CLValueBuilder.byteArray(
        Buffer.from(permit.collection_hash, "hex")
      ),
      token_owner: CLValueBuilder.key(
        CLValueBuilder.byteArray(
          Buffer.from(permit.token_owner.replace("account-hash-", ""), "hex")
        )
      ),
      token_metadata: CLValueBuilder.string(permit.token_metadata),
      nonce: CLValueBuilder.string(permit.nonce),
      expiry: CLValueBuilder.u64(permit.expiry),
      signature: CLValueBuilder.list(
        Array.from(Buffer.from(permit.signature, "hex"))
      ),
    })
  ),
  DeployUtil.standardPayment(5_000_000_000)
);

// Sign and send
const signedDeploy = await casperWallet.sign(deploy);
await client.putDeploy(signedDeploy);
```

### 3. Contract Validates and Mints

1. ✅ Check expiry timestamp
2. ✅ Check nonce hasn't been used
3. ✅ Verify signature matches authority key
4. ✅ Verify collection is allowed
5. ✅ Mark nonce as used
6. ✅ Call CEP-78 `mint()` entrypoint

## Build

```bash
cd contracts/+casper_authority_mint_permit
RUSTFLAGS='-C target-cpu=mvp' cargo +nightly-2025-02-04 build \
  --release --target wasm32-unknown-unknown \
  -Z build-std=std,panic_abort
```

## Deploy

```bash
# Update AUTHORITY_PUBLIC_KEY in deploy script
./deploy-authority-mint-permit.sh
```

## Entry Points

### `init(authority_public_key: PublicKey)`

Initialize contract with authority's public key.

### `mint_nft_with_permit(...)`

Mint NFT with signed permit.

**Args:**

- `collection_hash: ByteArray(32)` - Collection contract hash
- `token_owner: Key` - Recipient account
- `token_metadata: String` - NFT metadata JSON
- `nonce: String` - Unique nonce
- `expiry: U64` - Unix timestamp
- `signature: List<U8>` - Ed25519 signature

### `mint_nft(...)`

Original direct minting (no permit required).

### `allow_collection(collection_hash)`

Whitelist a collection.

### `disallow_collection(collection_hash)`

Remove collection from whitelist.

### `update_authority_key(new_authority_key)`

Update the authority's public key.

### `get_mint_count()`

Get total mints performed.

## Error Codes

| Code | Error                  |
| ---- | ---------------------- |
| 100  | Collection not allowed |
| 101  | Permit expired         |
| 102  | Nonce already used     |

## Backend API

### `POST /api/casper/request-mint-permit`

Request a signed permit.

**Body:**

```json
{
  "collectionHash": "376fb8f9264fd7cf...",
  "recipientAccountHash": "1877cb2417eb4f7f...",
  "metadata": {
    "name": "Tixia $100 Flight Credit",
    "token_uri": "https://..."
  },
  "validitySeconds": 3600
}
```

**Response:**

```json
{
  "success": true,
  "permit": {
    "collection_hash": "...",
    "token_owner": "account-hash-...",
    "token_metadata": "{...}",
    "nonce": "...",
    "expiry": 1234567890,
    "signature": "..."
  }
}
```

### `POST /api/casper/verify-permit`

Verify a permit signature.

### `GET /api/casper/authority-public-key`

Get authority's public key.

## Security

✅ **Nonce prevents replay** - Each permit can only be used once  
✅ **Expiry prevents abuse** - Permits expire after set time  
✅ **Signature verification** - Only authority can issue valid permits  
✅ **Collection whitelist** - Only approved collections can be minted

## Benefits vs Direct Minting

| Feature                | Direct Mint                  | Permit Mint            |
| ---------------------- | ---------------------------- | ---------------------- |
| **User pays gas**      | ❌ No (deployer pays)        | ✅ Yes                 |
| **Backend control**    | ✅ Full control              | ✅ Full control        |
| **Rate limiting**      | ❌ On-chain only             | ✅ Backend + on-chain  |
| **Eligibility checks** | ❌ Limited                   | ✅ Full business logic |
| **Scalability**        | ❌ Backend must sign all txs | ✅ Users sign own txs  |

## Use Cases

✅ **Faucet minting** - Users request permit, mint themselves  
✅ **Raffle winners** - Backend issues permit to winner  
✅ **Burn-to-mint** - Validate burn, issue mint permit  
✅ **Allowlist minting** - Check eligibility, issue permit  
✅ **Time-limited drops** - Permits expire after window

---

**Permit system = Backend control + User pays gas + Better UX**
