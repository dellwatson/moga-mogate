# Casper Ed25519 Signature Verification - Integration Guide

Complete guide for implementing signature-based authentication on Casper.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup](#setup)
4. [Contract Deployment](#contract-deployment)
5. [Backend Integration](#backend-integration)
6. [Frontend Integration](#frontend-integration)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What is this?

A complete implementation of **Ed25519 signature verification** on Casper blockchain, enabling:

- **Gasless transactions**: Backend signs, users submit
- **Authorization**: Only signed data can trigger contract actions
- **Oracles**: Offchain data verified onchain
- **Permits**: Pre-signed permissions

### Flow

```
┌──────────────┐
│   Backend    │ 1. Store signer private key
│  (Offchain)  │ 2. Sign data with Ed25519
└──────┬───────┘
       │
       │ 3. Send signature to user/frontend
       ▼
┌──────────────┐
│   Frontend   │ 4. Submit transaction with signature
└──────┬───────┘
       │
       │ 5. Call contract with (value, nonce, signature)
       ▼
┌──────────────────────────────┐
│   Smart Contract (Onchain)   │
│                              │
│ 6. Verify signature:         │
│    - Get stored public key   │
│    - Hash data               │
│    - Verify Ed25519          │
│                              │
│ 7. Execute if valid          │
└──────────────────────────────┘
```

---

## Architecture

### Components

1. **Smart Contract** (`/contracts/signature_verify`)
   - Stores authorized signer's public key
   - Verifies Ed25519 signatures
   - Prevents replay attacks with nonces

2. **TypeScript SDK** (`/ts-sdk/src/casper-signature-service.ts`)
   - Signs data with Ed25519
   - Generates nonces
   - Verifies signatures locally

3. **Backend API** (`/offchain/backend/src/casper-signature-api.ts`)
   - Exposes REST endpoints
   - Signs data on behalf of users
   - Manages private key securely

### Why Ed25519?

| Feature             | Ed25519 (Casper)  | ECDSA secp256k1 (Ethereum) |
| ------------------- | ----------------- | -------------------------- |
| Native Support      | ✅ Yes            | ❌ No (need library)       |
| Signature Size      | 64 bytes          | 65 bytes                   |
| Verification Speed  | Fast              | Slower                     |
| Casper Account Keys | ✅ Same algorithm | ❌ Different               |

---

## Setup

### 1. Generate Signer Keys

```bash
# Generate Ed25519 keypair for signing
casper-client keygen /path/to/signer_keys

# This creates:
# - signer_keys/public_key.pem
# - signer_keys/secret_key.pem
```

### 2. Environment Variables

Create `.env` file in backend:

```bash
# Casper Signature Service
SIGNER_PUBLIC_KEY_PATH=/path/to/signer_keys/public_key.pem
SIGNER_SECRET_KEY_PATH=/path/to/signer_keys/secret_key.pem

# Optional: Separate port for Casper service
CASPER_PORT=3001
```

### 3. Install Dependencies

```bash
# Backend
cd offchain/backend
bun install

# SDK
cd ts-sdk
bun install
```

---

## Contract Deployment

### 1. Build Contract

```bash
cd contracts/signature_verify
cargo build --release --target wasm32-unknown-unknown
```

Output: `target/wasm32-unknown-unknown/release/signature_verify.wasm`

### 2. Get Signer Public Key

```bash
# From PEM file
casper-client account-address --public-key /path/to/signer_keys/public_key.pem
```

Or use the backend API:

```bash
curl http://localhost:3001/api/casper/signer-public-key
```

### 3. Deploy Contract

```bash
casper-client put-deploy \
  --node-address http://65.109.222.111:7777 \
  --chain-name casper-test \
  --secret-key /path/to/deployer_secret_key.pem \
  --payment-amount 100000000000 \
  --session-path target/wasm32-unknown-unknown/release/signature_verify.wasm \
  --session-arg "signer_public_key:public_key='<SIGNER_PUBLIC_KEY_HEX>'"
```

Replace `<SIGNER_PUBLIC_KEY_HEX>` with the hex from step 2.

### 4. Get Contract Hash

```bash
casper-client get-deploy \
  --node-address http://65.109.222.111:7777 \
  <DEPLOY_HASH>
```

Look for `signature_verify_contract_hash` in the named keys.

---

## Backend Integration

### Option 1: Standalone Server

```bash
cd offchain/backend/src
bun run casper-signature-server.example.ts
```

### Option 2: Integrate into Existing Backend

```typescript
// In your existing Express app
import { setupSignatureRoutes } from "./casper-signature-api";

// Add routes
setupSignatureRoutes(app);
```

### API Endpoints

#### 1. Sign Data

```bash
POST /api/casper/sign-data

Body:
{
  "value": "Hello, Casper!",
  "nonce": "optional-custom-nonce"
}

Response:
{
  "success": true,
  "signedData": {
    "value": "Hello, Casper!",
    "nonce": "1234567890-abc...",
    "signature": "def..."
  }
}
```

#### 2. Verify Signature

```bash
POST /api/casper/verify-signature

Body:
{
  "signedData": {
    "value": "...",
    "nonce": "...",
    "signature": "..."
  }
}

Response:
{
  "success": true,
  "valid": true
}
```

#### 3. Get Signer Public Key

```bash
GET /api/casper/signer-public-key

Response:
{
  "success": true,
  "publicKey": "020363fc89757f974d8d08d8f61ffe805108e2bfc938234d841fd8101e4a08d6e257",
  "accountHash": "account-hash-..."
}
```

---

## Frontend Integration

### 1. Request Signature from Backend

```typescript
// Request signature from backend
const response = await fetch("http://localhost:3001/api/casper/sign-data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    value: "Update value to: Hello, Casper!",
  }),
});

const { signedData } = await response.json();
// {
//   value: "Update value to: Hello, Casper!",
//   nonce: "1234567890-abc...",
//   signature: "def..."
// }
```

### 2. Submit to Contract

```typescript
import {
  CasperClient,
  CLValueBuilder,
  DeployUtil,
  RuntimeArgs,
} from "casper-js-sdk";

const client = new CasperClient("http://65.109.222.111:7777/rpc");
const contractHash = "hash-abc123...";

// Create deploy
const args = RuntimeArgs.fromMap({
  value: CLValueBuilder.string(signedData.value),
  nonce: CLValueBuilder.string(signedData.nonce),
  signature: CLValueBuilder.byteArray(Buffer.from(signedData.signature, "hex")),
});

const deploy = DeployUtil.makeDeploy(
  new DeployUtil.DeployParams(userPublicKey, "casper-test"),
  DeployUtil.ExecutableDeployItem.newStoredContractByHash(
    Uint8Array.from(Buffer.from(contractHash.replace("hash-", ""), "hex")),
    "set_value_with_signature",
    args,
  ),
  DeployUtil.standardPayment(3000000000), // 3 CSPR
);

// Sign with user's key
const signedDeploy = deploy.sign([userKeys]);

// Submit
const deployHash = await client.putDeploy(signedDeploy);
console.log("Deploy hash:", deployHash);
```

### 3. Read Value

```typescript
const result = await client.queryContractData(contractHash, ["stored_value"]);

console.log("Stored value:", result);
```

---

## Security Best Practices

### 1. Private Key Management

✅ **DO:**

- Store private key in secure environment variables
- Use hardware security modules (HSM) in production
- Rotate keys periodically
- Use separate keys for different environments

❌ **DON'T:**

- Commit private keys to Git
- Share private keys
- Use same key across environments

### 2. Nonce Management

✅ **DO:**

- Generate unique nonces (timestamp + random)
- Check nonce hasn't been used (contract does this)
- Set reasonable expiry times

❌ **DON'T:**

- Reuse nonces
- Use predictable nonces
- Allow unlimited validity

### 3. Rate Limiting

```typescript
// Add to backend
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api/casper/", limiter);
```

### 4. Input Validation

```typescript
// Validate data before signing
if (!value || value.length > 1000) {
  return res.status(400).json({ error: "Invalid value" });
}
```

### 5. Access Control

```typescript
// Add authentication
app.post("/api/casper/sign-data", authenticateUser, async (req, res) => {
  // Only authenticated users can request signatures
  const userId = req.user.id;

  // Add business logic
  if (!(await isUserAuthorized(userId))) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  // Sign data...
});
```

---

## Troubleshooting

### Error: "Invalid signature length"

**Cause:** Signature is not 64 bytes

**Solution:**

```typescript
// Ensure signature is hex-encoded 64 bytes (128 hex chars)
console.log("Signature length:", signedData.signature.length); // Should be 128
```

### Error: "Invalid signature"

**Cause:** Signature verification failed

**Solutions:**

1. Check signer public key matches contract's stored key
2. Verify message construction is identical (offchain vs onchain)
3. Test signature locally first:

```typescript
const signer = loadSignatureService(...);
const signedData = signer.signData(value, nonce);
const isValid = signer.verifySignature(signedData);
console.log('Valid:', isValid); // Should be true
```

### Error: "Nonce already used"

**Cause:** Replay attack prevention

**Solution:** Generate a new nonce for each request

### Contract Not Found

**Cause:** Wrong contract hash or network

**Solutions:**

1. Verify contract hash: `casper-client query-global-state ...`
2. Check network (testnet vs mainnet)
3. Ensure contract was deployed successfully

---

## Advanced Use Cases

### 1. Structured Data (EIP-712 style)

```typescript
// Backend
const data = {
  action: "transfer",
  recipient: "account-hash-...",
  amount: 1000,
  deadline: Math.floor(Date.now() / 1000) + 3600,
};

// Create canonical JSON (sorted keys)
const canonical = JSON.stringify(data, Object.keys(data).sort());
const signedData = signer.signData(canonical, nonce);
```

### 2. Multi-Signature

```rust
// Contract: Store multiple authorized signers
const AUTHORIZED_SIGNERS: &str = "authorized_signers";

// Require N of M signatures
fn verify_multi_sig(signatures: Vec<Signature>) {
    let required = 2; // 2 of 3
    let valid_count = signatures.iter()
        .filter(|sig| verify_signature(sig))
        .count();

    if valid_count < required {
        runtime::revert(ApiError::User(104));
    }
}
```

### 3. Time-Locked Signatures

```rust
// Contract: Add time constraints
let valid_from: u64 = runtime::get_named_arg("valid_from");
let valid_until: u64 = runtime::get_named_arg("valid_until");

let now = runtime::get_blocktime().into();
if now < valid_from || now > valid_until {
    runtime::revert(ApiError::User(105)); // Time constraint violated
}
```

---

## Comparison with Existing Permit System

You already have `authority_mint_permit` which is more complex. Here's the comparison:

| Feature    | `signature_verify`             | `authority_mint_permit`                                   |
| ---------- | ------------------------------ | --------------------------------------------------------- |
| Purpose    | Generic signature verification | NFT minting with permits                                  |
| Complexity | Simple                         | Complex                                                   |
| Use Case   | Any data verification          | NFT minting only                                          |
| Parameters | 3 (value, nonce, signature)    | 6 (collection, owner, metadata, nonce, expiry, signature) |
| Best For   | Learning / Simple cases        | Production NFT minting                                    |

**When to use which:**

- Use `signature_verify` for: Simple authorization, learning, prototyping
- Use `authority_mint_permit` for: Production NFT minting with full features

---

## Next Steps

1. ✅ Deploy contract to testnet
2. ✅ Test signature generation locally
3. ✅ Integrate backend API
4. ✅ Build frontend UI
5. ✅ Add monitoring and logging
6. ✅ Security audit before mainnet

---

## Resources

- [Casper Documentation](https://docs.casper.network/)
- [Ed25519 Specification](https://ed25519.cr.yp.to/)
- [Blake2 Hashing](https://www.blake2.net/)
- [casper-js-sdk](https://github.com/casper-ecosystem/casper-js-sdk)

---

## Support

For questions or issues:

1. Check existing contracts in `/contracts/authority_mint_permit`
2. Review SDK examples in `/ts-sdk/src/*.example.ts`
3. Test with backend API in `/offchain/backend/src`
