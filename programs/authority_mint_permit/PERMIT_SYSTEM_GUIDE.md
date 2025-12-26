# Authority Mint with Permit System

## Overview

**Signature-based permit system** to control who can mint NFTs/SFTs.

### **Key Concept:**
- ❌ **Without permit:** Anyone can mint (open faucet)
- ✅ **With permit:** Only users with admin signature can mint

---

## How It Works

### **Flow Diagram:**

```
1. User requests mint on dApp
   ↓
2. dApp calls backend API
   ↓
3. Backend checks whitelist
   ↓
4. Backend creates message:
   hash(user_pubkey, name, symbol, uri, max_supply, nonce)
   ↓
5. Backend signs with admin private key
   ↓
6. Backend returns: signature + nonce
   ↓
7. User submits to program:
   - Params: name, symbol, uri, max_supply, nonce
   - Signature: 64 bytes
   - Admin pubkey
   ↓
8. Program verifies signature
   ↓
9. If valid → Mint NFT/SFT
10. If invalid → Reject
```

---

## Message Format

### **What Gets Signed:**

```typescript
message = concat(
  user_pubkey,      // 32 bytes
  name,             // UTF-8 bytes
  symbol,           // UTF-8 bytes
  uri,              // UTF-8 bytes
  max_supply,       // 8 bytes (u64 little-endian)
  nonce             // 8 bytes (u64 little-endian)
)

message_hash = SHA256(message)
signature = Ed25519Sign(message_hash, admin_private_key)
```

### **Example:**

```typescript
// User wants to mint
user = "EKGGkpWWhSjksrKQW8EadTbsvmg1uGrpwg33fTXZTDmA"
name = "Qatar Business DOH-LHR"
symbol = "QR-BIZ"
uri = "https://.../metadata.json"
max_supply = 0  // NFT
nonce = 1732478400000  // Timestamp

// Backend creates message
message = user + name + symbol + uri + max_supply + nonce

// Backend signs
signature = sign(SHA256(message), admin_private_key)

// User submits to program
program.mint_nft_with_permit(
  name, symbol, uri, max_supply, nonce, signature
)
```

---

## Security Features

### **1. Signature Verification**
- ✅ Only admin can create valid signatures
- ✅ Signature proves admin approved this specific mint
- ✅ If params change, signature becomes invalid

### **2. Nonce (Prevents Replay Attacks)**
- ✅ Each signature is unique (includes nonce)
- ✅ Can't reuse old signatures
- ✅ Nonce included in mint PDA (prevents double-mint)

### **3. Whitelist Control**
- ✅ Backend checks whitelist before signing
- ✅ Only whitelisted users get signatures
- ✅ Admin controls who can mint

---

## Backend Implementation

### **Setup:**

```bash
cd offchain
bun install tweetnacl
```

### **Sign Permit:**

```typescript
import { signMintPermit } from "./backend-permit-signer";

// User requests mint
const userPubkey = new PublicKey("EKGGkpWWhSjksrKQW8EadTbsvmg1uGrpwg33fTXZTDmA");
const name = "Qatar Business DOH-LHR";
const symbol = "QR-BIZ";
const uri = "https://.../metadata.json";
const maxSupply = 0; // 0 = NFT, >0 = SFT
const nonce = Date.now(); // Unique timestamp

// Sign permit
const signature = signMintPermit(
  userPubkey,
  name,
  symbol,
  uri,
  maxSupply,
  nonce
);

// Return to frontend
return {
  signature: Array.from(signature), // [u8; 64]
  nonce,
  adminPubkey: "YOUR_ADMIN_PUBKEY",
};
```

### **API Endpoint Example:**

```typescript
// Express.js
app.post("/api/mint-permit", async (req, res) => {
  const { userPubkey, name, symbol, uri, maxSupply } = req.body;

  // 1. Validate user is whitelisted
  if (!isWhitelisted(userPubkey)) {
    return res.status(403).json({ error: "Not whitelisted" });
  }

  // 2. Check rate limits
  if (hasExceededRateLimit(userPubkey)) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  // 3. Validate params
  if (name.length > 32 || symbol.length > 10) {
    return res.status(400).json({ error: "Invalid params" });
  }

  // 4. Generate nonce
  const nonce = Date.now();

  // 5. Sign permit
  const signature = signMintPermit(
    new PublicKey(userPubkey),
    name,
    symbol,
    uri,
    maxSupply,
    nonce
  );

  // 6. Log for audit
  console.log(`Permit signed for ${userPubkey}: ${name}`);

  // 7. Return signature
  res.json({
    signature: Array.from(signature),
    nonce,
    adminPubkey: adminKeypair.publicKey.toBase58(),
  });
});
```

---

## Frontend Implementation

### **Request Permit:**

```typescript
// 1. User clicks "Mint" button
async function requestMintPermit(
  name: string,
  symbol: string,
  uri: string,
  maxSupply: number
) {
  // Call backend API
  const response = await fetch("/api/mint-permit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPubkey: wallet.publicKey.toBase58(),
      name,
      symbol,
      uri,
      maxSupply,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get permit");
  }

  const { signature, nonce, adminPubkey } = await response.json();

  return { signature, nonce, adminPubkey };
}
```

### **Submit to Program:**

```typescript
async function mintWithPermit(
  name: string,
  symbol: string,
  uri: string,
  maxSupply: number | null
) {
  // 1. Get permit from backend
  const { signature, nonce, adminPubkey } = await requestMintPermit(
    name,
    symbol,
    uri,
    maxSupply || 0
  );

  // 2. Derive PDAs
  const [mintPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("mint"),
      wallet.publicKey.toBuffer(),
      Buffer.from(new BigUint64Array([BigInt(nonce)]).buffer),
    ],
    PROGRAM_ID
  );

  const [authorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    PROGRAM_ID
  );

  // 3. Call program
  await program.methods
    .mintNftWithPermit(
      name,
      symbol,
      uri,
      maxSupply ? { some: maxSupply } : null,
      nonce,
      signature
    )
    .accounts({
      payer: wallet.publicKey,
      admin: new PublicKey(adminPubkey),
      authority: authorityPda,
      collectionMint: COLLECTION_MINT,
      mint: mintPda,
      // ... other accounts
    })
    .rpc();

  console.log("✅ Minted NFT:", mintPda.toBase58());
}
```

---

## Comparison: With vs Without Permit

| Feature | Without Permit | With Permit |
|---------|----------------|-------------|
| **Who can mint?** | Anyone | Only whitelisted users |
| **Backend required?** | ❌ No | ✅ Yes |
| **Rate limiting?** | ❌ No | ✅ Yes (backend) |
| **Whitelist?** | ❌ No | ✅ Yes (backend) |
| **Security** | ⚠️ Open faucet | ✅ Controlled |
| **Use case** | Testing only | Production |

---

## Security Considerations

### **✅ What's Protected:**
1. **Only admin can create valid signatures**
2. **Signature proves admin approved this mint**
3. **Nonce prevents replay attacks**
4. **Backend can enforce whitelist/rate limits**

### **⚠️ What's NOT Protected:**
1. **User still pays gas** (not free minting)
2. **Signature is public** (anyone can see it)
3. **Backend must be secure** (private key protection)

### **Best Practices:**

1. **Secure Admin Private Key:**
   ```bash
   # Store in secure location
   export ADMIN_KEYPAIR_PATH=/secure/path/admin-keypair.json
   chmod 600 /secure/path/admin-keypair.json
   ```

2. **Rate Limiting:**
   ```typescript
   // Max 5 mints per user per day
   const rateLimits = new Map<string, number>();
   
   function checkRateLimit(userPubkey: string): boolean {
     const count = rateLimits.get(userPubkey) || 0;
     if (count >= 5) return false;
     rateLimits.set(userPubkey, count + 1);
     return true;
   }
   ```

3. **Whitelist Management:**
   ```typescript
   // Store whitelist in database
   const whitelist = new Set([
     "EKGGkpWWhSjksrKQW8EadTbsvmg1uGrpwg33fTXZTDmA",
     "2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r",
   ]);
   
   function isWhitelisted(userPubkey: string): boolean {
     return whitelist.has(userPubkey);
   }
   ```

4. **Audit Logging:**
   ```typescript
   // Log all permit requests
   console.log({
     timestamp: new Date().toISOString(),
     user: userPubkey,
     action: "mint_permit_signed",
     nft: name,
   });
   ```

---

## Deployment

### **1. Build Program:**

```bash
anchor build -p authority_mint_permit
```

### **2. Get Program ID:**

```bash
anchor keys list
# Copy authority_mint_permit program ID
```

### **3. Update Program ID:**

**File: `programs/authority_mint_permit/src/lib.rs`**
```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

**File: `Anchor.toml`**
```toml
[programs.devnet]
authority_mint_permit = "YOUR_PROGRAM_ID_HERE"
```

### **4. Rebuild & Deploy:**

```bash
anchor build -p authority_mint_permit
anchor deploy -p authority_mint_permit --provider.cluster devnet
```

### **5. Setup Backend:**

```bash
cd offchain
bun install
bun run backend-permit-signer.ts
```

---

## Summary

### **What You Get:**
- ✅ Controlled minting (only whitelisted users)
- ✅ Rate limiting (backend enforced)
- ✅ Audit trail (backend logs)
- ✅ Signature verification (on-chain)
- ✅ Replay protection (nonce)

### **Flow:**
1. User requests mint → Backend checks whitelist
2. Backend signs permit → Returns signature
3. User submits to program → Program verifies signature
4. If valid → Mint NFT/SFT

### **Security:**
- Admin private key signs permits
- Signature proves admin approval
- Nonce prevents replay attacks
- Backend controls access

**Ready to deploy!** 🚀
