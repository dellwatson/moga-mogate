# Complete Guide - Authority Mint Permit

## Your Questions Answered

### **1. Why Accept Any Pubkey? We Need Program State!**

**✅ FIXED!** The program now stores admin pubkey in on-chain state:

```rust
/// Program configuration (stored on-chain)
#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,  // ← Admin pubkey stored here
    pub bump: u8,
}
```

**Flow:**
1. Deploy program
2. Call `initialize(your_wallet_pubkey)` → Stores admin pubkey
3. Program verifies all signatures against this stored pubkey
4. Can update admin with `update_admin()` if needed

**No more accepting random pubkeys!** ✅

---

### **2. How to Get Admin Private Key in Base58?**

#### **From Solana CLI Wallet:**

```bash
# Your wallet file
cat ~/.config/solana/id.json
# Output: [219, 220, 213, 7, 101, 17, 205, 172, ...]

# Convert to base58 (run the backend script)
bun run offchain/backend-permit-signer.ts
# Output shows: Private Key (Base58): 5Kd3NBUAdUnhyzenEwVLy...
```

#### **From Phantom Wallet:**

1. Open Phantom
2. Settings → Security & Privacy
3. Export Private Key
4. Copy the base58 string

#### **Use in .env:**

```bash
# Option 1: File path (JSON array)
ADMIN_KEYPAIR_PATH=/path/to/admin-keypair.json

# Option 2: Base58 string (from Phantom or conversion)
ADMIN_PRIVATE_KEY_BASE58=5Kd3NBUAdUnhyzenEwVLy9pBKxSwXvE9FMPyR4UKZvpe6E6VqjT...
```

**The JSON array `[219, 220, ...]` IS your private key!** It's just in a different format.

---

### **3. Two Methods: With Nonce vs Without Nonce**

**✅ IMPLEMENTED!** You now have both methods:

#### **Method 1: `mint_nft_with_permit` (WITH nonce)**
- ✅ Prevents signature reuse
- ✅ On-chain nonce tracking
- ✅ Most secure
- ⚠️ Costs more gas (creates NonceTracker account)

```typescript
// Backend signs WITH nonce
const signature = signMintPermitWithNonce(user, name, symbol, uri, maxSupply, nonce);

// Frontend calls
await program.methods.mintNftWithPermit(name, symbol, uri, maxSupply, nonce, signature);
```

#### **Method 2: `mint_nft_simple` (WITHOUT nonce)**
- ✅ Simpler
- ✅ Cheaper gas (no nonce tracking)
- ⚠️ Signature can be reused
- ⚠️ Less secure

```typescript
// Backend signs WITHOUT nonce
const signature = signMintPermitSimple(user, name, symbol, uri, maxSupply);

// Frontend calls
await program.methods.mintNftSimple(name, symbol, uri, maxSupply, signature);
```

---

## Program Architecture

### **On-Chain State:**

```rust
// Program Config (PDA: [b"config"])
ProgramConfig {
    admin: Pubkey,  // Your wallet that signs permits
    bump: u8,
}

// Nonce Tracker (PDA: [b"nonce", user, nonce])
NonceTracker {
    user: Pubkey,
    nonce: u64,
    used_at: i64,
}
```

### **Methods:**

1. **`initialize(admin_pubkey)`** - Set admin (call once after deployment)
2. **`update_admin(new_admin)`** - Change admin (only current admin can call)
3. **`mint_nft_with_permit(..., nonce, signature)`** - Mint with nonce tracking
4. **`mint_nft_simple(..., signature)`** - Mint without nonce tracking

---

## Deployment Steps

### **Step 1: Deploy Program**

```bash
anchor build -p authority_mint_permit
anchor deploy -p authority_mint_permit --provider.cluster devnet
```

### **Step 2: Initialize Program**

```typescript
// Get your wallet pubkey
const adminPubkey = wallet.publicKey;

// Initialize program config
await program.methods
  .initialize(adminPubkey)
  .accounts({
    config: configPda,
    authority: wallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log("✅ Program initialized with admin:", adminPubkey.toBase58());
```

### **Step 3: Setup Backend**

```bash
# Install dependencies
cd offchain
bun install bs58

# Create .env
echo "ADMIN_PRIVATE_KEY_BASE58=YOUR_BASE58_KEY_HERE" > .env

# Test signing
bun run backend-permit-signer.ts
```

### **Step 4: Test Minting**

```typescript
// Get permit from backend
const { signature, nonce } = await fetch("/api/mint-permit", {
  method: "POST",
  body: JSON.stringify({ userPubkey, name, symbol, uri, maxSupply }),
}).then(r => r.json());

// Mint NFT
await program.methods
  .mintNftWithPermit(name, symbol, uri, maxSupply, nonce, signature)
  .accounts({
    payer: wallet.publicKey,
    config: configPda,
    // ... other accounts
  })
  .rpc();
```

---

## Security Comparison

| Feature | With Nonce | Without Nonce |
|---------|-----------|---------------|
| **Signature Reuse** | ❌ Prevented | ⚠️ Possible |
| **On-Chain Tracking** | ✅ Yes | ❌ No |
| **Gas Cost** | Higher | Lower |
| **Security** | High | Medium |
| **Use Case** | Production | Testing/Trusted |

---

## How Signature Verification Works

### **Backend (Offchain):**

```typescript
// 1. Construct message
const message = concat(
  user_pubkey,
  name,
  symbol,
  uri,
  max_supply,
  nonce  // ← Only if using nonce method
);

// 2. Hash message
const hash = SHA256(message);

// 3. Sign with admin private key
const signature = Ed25519Sign(hash, admin_private_key);

// 4. Return signature to user
return { signature, nonce };
```

### **Program (On-Chain):**

```rust
// 1. Reconstruct message (same format)
let message = concat(
  user_pubkey,
  name,
  symbol,
  uri,
  max_supply,
  nonce  // ← Only if using nonce method
);

// 2. Hash message
let hash = SHA256(message);

// 3. Verify signature against stored admin pubkey
verify_signature(hash, signature, config.admin)?;

// 4. If valid → mint NFT
// 5. If invalid → reject
```

**Key Point:** Message must be EXACTLY the same on both sides!

---

## Private Key Formats Explained

### **Format 1: JSON Array (Solana CLI)**
```json
[219, 220, 213, 7, 101, 17, 205, 172, ...]
```
- **64 bytes total**
- Bytes 0-31: Private key seed
- Bytes 32-63: Public key
- Used by: Solana CLI, Anchor

### **Format 2: Base58 (Wallets)**
```
5Kd3NBUAdUnhyzenEwVLy9pBKxSwXvE9FMPyR4UKZvpe6E6VqjT...
```
- **Same 64 bytes, just encoded differently**
- Used by: Phantom, Solflare, most wallets
- Easier to copy/paste

### **Convert Between Formats:**

```typescript
import bs58 from "bs58";

// JSON array → Base58
const jsonArray = [219, 220, 213, ...];
const base58 = bs58.encode(new Uint8Array(jsonArray));

// Base58 → JSON array
const secretKey = bs58.decode(base58);
const jsonArray = Array.from(secretKey);
```

**Both formats represent the SAME private key!**

---

## Example: Complete Flow

### **1. Deploy & Initialize:**

```bash
# Deploy
anchor deploy -p authority_mint_permit --provider.cluster devnet

# Get your wallet pubkey
solana address
# Output: 2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r
```

```typescript
// Initialize program
await program.methods
  .initialize(new PublicKey("2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r"))
  .rpc();
```

### **2. Setup Backend:**

```bash
# .env
ADMIN_PRIVATE_KEY_BASE58=5Kd3NBUAdUnhyzenEwVLy...
```

### **3. User Requests Mint:**

```typescript
// User clicks "Mint" in dApp
const response = await fetch("/api/mint-permit", {
  method: "POST",
  body: JSON.stringify({
    userPubkey: wallet.publicKey.toBase58(),
    name: "Qatar Business DOH-LHR",
    symbol: "QR-BIZ",
    uri: "https://...",
    maxSupply: 0,
  }),
});

const { signature, nonce } = await response.json();
```

### **4. Backend Signs:**

```typescript
// Backend API endpoint
app.post("/api/mint-permit", (req, res) => {
  const { userPubkey, name, symbol, uri, maxSupply } = req.body;
  
  // Generate nonce
  const nonce = Date.now();
  
  // Sign permit
  const signature = signMintPermitWithNonce(
    new PublicKey(userPubkey),
    name,
    symbol,
    uri,
    maxSupply,
    nonce
  );
  
  res.json({ signature: Array.from(signature), nonce });
});
```

### **5. User Mints:**

```typescript
// User submits to program
await program.methods
  .mintNftWithPermit(name, symbol, uri, maxSupply, nonce, signature)
  .accounts({
    payer: wallet.publicKey,
    config: configPda,
    authority: authorityPda,
    collectionMint: COLLECTION_MINT,
    mint: mintPda,
    tokenAccount: tokenAccountPda,
    metadata: metadataPda,
    masterEdition: masterEditionPda,
    nonceTracker: nonceTrackerPda,
    // ... programs
  })
  .rpc();

console.log("✅ NFT minted!");
```

---

## Summary

### **What You Asked For:**

1. ✅ **Admin pubkey stored in program state** (not passed by user)
2. ✅ **Private key in .env** (base58 format supported)
3. ✅ **Two methods:** with nonce (secure) and without nonce (simple)

### **Key Points:**

- **Admin pubkey:** Stored on-chain in `ProgramConfig`
- **Private key format:** JSON array `[219, ...]` = Base58 string (same key, different encoding)
- **Nonce tracking:** Prevents signature reuse (optional)
- **Two methods:** Choose based on security needs

### **Next Steps:**

1. Deploy program
2. Initialize with your wallet pubkey
3. Setup backend with private key in .env
4. Test both minting methods
5. Choose method based on needs

**Ready to deploy!** 🚀
