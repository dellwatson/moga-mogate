# Signature Verification Contract

A generic Casper smart contract demonstrating **Ed25519 signature verification**.

## Concept

This contract implements a simple but powerful pattern:

1. **Store** a trusted signer's public key (Ed25519)
2. **Offchain**: Sign data with the corresponding private key
3. **Onchain**: Verify the signature matches the stored public key
4. **Execute** action only if signature is valid

## Flow Diagram

```
┌─────────────┐
│  Offchain   │
│   Backend   │
└──────┬──────┘
       │
       │ 1. Generate signature
       │    Sign(Blake2b(value || nonce))
       │    with private key
       │
       ▼
┌─────────────┐
│    User     │
│  (Frontend) │
└──────┬──────┘
       │
       │ 2. Submit transaction
       │    - value
       │    - nonce
       │    - signature
       │
       ▼
┌─────────────────────────────┐
│   Casper Smart Contract     │
│                             │
│  3. Verify signature        │
│     - Get stored public key │
│     - Hash: Blake2b(value||nonce)
│     - Verify Ed25519 sig    │
│                             │
│  4. Check conditions        │
│     - Nonce not used        │
│     - Signature valid       │
│                             │
│  5. Execute if valid        │
│     - Mark nonce as used    │
│     - Store value           │
└─────────────────────────────┘
```

## Why Ed25519?

Casper uses **Ed25519** for account keys, making it the natural choice:

- Fast verification
- Small signatures (64 bytes)
- Native support in Casper runtime
- Industry standard (used in SSH, TLS, etc.)

## Use Cases

- **Gasless transactions**: Backend signs, user submits
- **Authorization**: Only signed data can trigger actions
- **Oracles**: Offchain data signed by trusted source
- **Permits**: Pre-signed permissions (like the permit system)

## Building

```bash
cd contracts/signature_verify
cargo build --release --target wasm32-unknown-unknown
```

The WASM will be at: `target/wasm32-unknown-unknown/release/signature_verify.wasm`

## Deployment

```bash
casper-client put-deploy \
  --node-address http://65.109.222.111:7777 \
  --chain-name casper-test \
  --secret-key /path/to/secret_key.pem \
  --payment-amount 100000000000 \
  --session-path target/wasm32-unknown-unknown/release/signature_verify.wasm \
  --session-arg "signer_public_key:public_key='<YOUR_SIGNER_PUBLIC_KEY>'"
```

## Usage Example

### 1. Offchain: Generate Signature

```typescript
import { CasperSignatureService } from "./casper-signature-service";

const signer = new CasperSignatureService(privateKeyPath, publicKeyPath);

const value = "Hello, Casper!";
const nonce = Date.now().toString();

const signature = signer.signData(value, nonce);
// Returns: { value, nonce, signature: "abc123..." }
```

### 2. Submit to Contract

```typescript
const deploy = contract.callEntrypoint(
  "set_value_with_signature",
  RuntimeArgs.fromMap({
    value: CLValueBuilder.string(value),
    nonce: CLValueBuilder.string(nonce),
    signature: CLValueBuilder.byteArray(Buffer.from(signature, "hex")),
  }),
);
```

### 3. Contract Verifies

The contract will:

- ✅ Check nonce hasn't been used
- ✅ Verify signature matches stored public key
- ✅ Store value if valid
- ❌ Revert if invalid

## Error Codes

- `101`: Nonce already used (replay attack prevention)
- `102`: Invalid signature length (must be 64 bytes)
- `103`: Invalid signature (verification failed)

## Security Considerations

1. **Nonce Management**: Each nonce can only be used once
2. **Replay Protection**: Old signatures cannot be reused
3. **Key Rotation**: Use `update_signer` to change authorized key
4. **Access Control**: Add admin checks in production

## Comparison: EIP-712 vs Ed25519

| Feature         | EIP-712 (Ethereum) | Ed25519 (Casper)    |
| --------------- | ------------------ | ------------------- |
| Algorithm       | ECDSA secp256k1    | Ed25519             |
| Signature Size  | 65 bytes           | 64 bytes            |
| Structured Data | Yes (typed)        | Manual (JSON/bytes) |
| Native Support  | Ethereum           | Casper              |
| Speed           | Slower             | Faster              |

On Casper, we use **Ed25519** because:

- It's the native account key type
- Built-in verification in runtime
- More efficient than importing ECDSA libraries

## Advanced: Structured Data Signing

For complex data (like EIP-712), create a canonical representation:

```rust
fn create_structured_message(data: &MyStruct) -> Vec<u8> {
    // Create deterministic JSON
    let json = format!(
        r#"{{"field1":"{}","field2":{}}}"#,
        data.field1, data.field2
    );
    json.into_bytes()
}
```

Then hash and sign as usual.
