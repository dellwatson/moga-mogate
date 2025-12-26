# Authority Mint Program - Deployment Guide

## What This Program Does

### **NFT/SFT Faucet for Testing**

This program allows **anyone** to mint NFTs or SFTs from your collection on Devnet.

**⚠️ WARNING: DEVNET ONLY! Never deploy to mainnet - anyone can mint unlimited NFTs!**

---

## How It Works

### **User Flow:**

```
1. User opens your dApp
2. User enters:
   - Name (e.g., "Qatar Business DOH-LHR")
   - Symbol (e.g., "QR-BIZ")
   - URI (e.g., "https://raw.githubusercontent.com/.../metadata.json")
   - Max Supply (0 for NFT, 1000 for SFT)
3. User clicks "Mint"
4. Program creates NFT/SFT and sends to user's wallet
```

### **What User Provides:**
- ✅ Collection address (hardcoded in dApp)
- ✅ Name, symbol, URI (input fields)
- ✅ Max supply (0 = NFT, >0 = SFT)

### **What User DOESN'T Provide:**
- ❌ Mint address (program creates it automatically as PDA)

### **What Program Creates:**
- ✅ New mint address (PDA: `[b"mint", user_pubkey]`)
- ✅ Metadata account
- ✅ Master edition account
- ✅ Token account for user

---

## NFT vs SFT

### **NFT (1/1):**
```rust
max_supply: None  // or Some(0)
```
- Creates unique 1/1 NFT
- Cannot mint more copies
- Example: Specific flight booking

### **SFT (Semi-Fungible):**
```rust
max_supply: Some(1000)
```
- Creates SFT with 1000 max supply
- Can mint up to 1000 copies
- Example: $500 flight credit

---

## Deployment Steps

### **1. Remove Empty Program from Anchor.toml**

The build fails because `rwa_raffle_simple` folder is empty.

**Option A: Delete the folder**
```bash
rm -rf programs/rwa_raffle_simple
```

**Option B: Or create a dummy Cargo.toml**
```bash
cat > programs/rwa_raffle_simple/Cargo.toml << 'EOF'
[package]
name = "rwa_raffle_simple"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "rwa_raffle_simple"

[dependencies]
anchor-lang = "0.31.1"
EOF
```

### **2. Build the Program**

```bash
anchor build -p authority_mint
```

This will:
- Generate keypair at `target/deploy/authority_mint-keypair.json`
- Build the program
- Output program ID

### **3. Update Program ID**

```bash
# Get the program ID
anchor keys list

# Copy the authority_mint program ID
# It will look like: 8xKXt2vqz7CqgBkUxGa7p12gLonY8aaezQMPJMfjESBVb
```

Update in two places:

**File 1: `programs/authority_mint/src/lib.rs`**
```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

**File 2: `Anchor.toml`**
```toml
[programs.devnet]
authority_mint = "YOUR_PROGRAM_ID_HERE"
```

### **4. Rebuild**

```bash
anchor build -p authority_mint
```

### **5. Deploy to Devnet**

```bash
anchor deploy -p authority_mint --provider.cluster devnet
```

---

## dApp Integration

### **Frontend Code Example:**

```typescript
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// Your collection address
const COLLECTION_MINT = new PublicKey("ghRQMiDxCyvE9QHLUjnZyKVm71FvhZLiyTUfY1GwHP3");

// Program ID (after deployment)
const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID_HERE");

async function mintNFT(
  name: string,
  symbol: string,
  uri: string,
  maxSupply: number | null  // null for NFT, number for SFT
) {
  const provider = AnchorProvider.env();
  const program = new Program(IDL, PROGRAM_ID, provider);
  
  const user = provider.wallet.publicKey;
  
  // Derive PDA for mint
  const [mintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint"), user.toBuffer()],
    PROGRAM_ID
  );
  
  // Derive PDA for authority
  const [authorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    PROGRAM_ID
  );
  
  // Derive metadata account
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mintPda.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  
  // Derive master edition account
  const [masterEditionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mintPda.toBuffer(),
      Buffer.from("edition"),
    ],
    METADATA_PROGRAM_ID
  );
  
  // Get user's token account
  const tokenAccount = await getAssociatedTokenAddress(
    mintPda,
    user
  );
  
  // Call program
  await program.methods
    .mintNft(name, symbol, uri, maxSupply)
    .accounts({
      payer: user,
      authority: authorityPda,
      collectionMint: COLLECTION_MINT,
      mint: mintPda,
      tokenAccount,
      metadata: metadataPda,
      masterEdition: masterEditionPda,
    })
    .rpc();
    
  console.log("✅ Minted NFT:", mintPda.toString());
}

// Example usage
await mintNFT(
  "Qatar Business DOH-LHR",
  "QR-BIZ",
  "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/nfts/flights/1of1-qatar-business-roundtrip.json",
  null  // null = NFT, 1000 = SFT with 1000 supply
);
```

---

## UI Example

```tsx
function MintNFTForm() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [uri, setUri] = useState("");
  const [isSFT, setIsSFT] = useState(false);
  const [maxSupply, setMaxSupply] = useState(1000);
  
  return (
    <div>
      <h2>Mint NFT/SFT</h2>
      
      <input
        placeholder="Name (max 32 chars)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={32}
      />
      
      <input
        placeholder="Symbol (max 10 chars)"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        maxLength={10}
      />
      
      <input
        placeholder="Metadata URI"
        value={uri}
        onChange={(e) => setUri(e.target.value)}
      />
      
      <label>
        <input
          type="checkbox"
          checked={isSFT}
          onChange={(e) => setIsSFT(e.target.checked)}
        />
        SFT (Semi-Fungible Token)
      </label>
      
      {isSFT && (
        <input
          type="number"
          placeholder="Max Supply"
          value={maxSupply}
          onChange={(e) => setMaxSupply(parseInt(e.target.value))}
        />
      )}
      
      <button onClick={() => mintNFT(name, symbol, uri, isSFT ? maxSupply : null)}>
        Mint {isSFT ? "SFT" : "NFT"}
      </button>
      
      <p>Collection: {COLLECTION_MINT.toString()}</p>
    </div>
  );
}
```

---

## Summary

### **What User Provides in dApp:**
1. ✅ Name (input field)
2. ✅ Symbol (input field)
3. ✅ URI (input field or dropdown)
4. ✅ Max Supply (checkbox + number input)

### **What's Hardcoded:**
1. ✅ Collection address (in dApp code)
2. ✅ Program ID (in dApp code)

### **What Program Creates:**
1. ✅ Mint address (PDA)
2. ✅ Metadata account
3. ✅ Master edition account
4. ✅ Token account

### **NFT vs SFT:**
- **NFT:** `maxSupply = null` or `0`
- **SFT:** `maxSupply = 1000` (or any number > 0)

---

## Next Steps

1. Fix Anchor.toml (remove empty program)
2. Build: `anchor build -p authority_mint`
3. Get program ID: `anchor keys list`
4. Update `declare_id!()` and `Anchor.toml`
5. Rebuild: `anchor build -p authority_mint`
6. Deploy: `anchor deploy -p authority_mint --provider.cluster devnet`
7. Build dApp with collection address hardcoded
8. Users can mint NFTs/SFTs!

**Ready to deploy!** 🚀
