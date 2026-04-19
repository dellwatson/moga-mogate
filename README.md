# Mogate FHE-Powered NFT Systems

This repo contains **Fhenix coFHE** powered contracts focused on privacy-preserving NFT systems:

- **ERC721MG Giftcodes:** ERC721-compatible NFTs that carry FHE-encrypted voucher codes which only become readable by the holder after redeeming to a soulbound token (SBT).
- **Privacy Vault (ERC721):** NFTs sit in a public vault address, while the _real owner_ is tracked as an **encrypted address**.

## FHE-Powered Systems Overview

### A) ERC721MG – Encrypted Giftcode NFTs

ERC721MG is an ERC721 collection where each token represents a **giftcode NFT**:

- On mint, the backend:
  - Generates a giftcode.
  - Encrypts it (AES+FHE or pure-FHE).
  - Passes **only ciphertexts and FHE handles** into the contract.
- On-chain, ERC721MG stores:
  - A public metadata URI (for OpenSea/wallets).
  - A public ciphertext reference (optional).
  - A public FHE ciphertext handle per `tokenId`.
- On redeem, ERC721MG:
  - Locks the token into **soulbound** state.
  - Calls `FHE.allow` so **only the current holder** can decrypt via `@cofhe/sdk`.

**Privacy Model:**

- **NFT stage:** Giftcode hidden from everyone (including owner). FHE ciphertext exists, but no address has decrypt rights yet.
- **SBT stage:** Only the current holder can decrypt and view the giftcode, because the contract has granted that address in the FHE ACL.

### B) Privacy Vault (ERC721)

NFTs are held in a public vault contract with **encrypted beneficial ownership**:

- The vault address appears as owner on-chain.
- The real owner is stored as an encrypted address (`eaddress`).
- Transfers of beneficial ownership happen privately inside the vault contract using FHE.

ERC721MG tokens can be shielded into the vault to hide who actually holds a given giftcode NFT.

---

## ERC721MG – Encrypted Giftcode NFTs

`ERC721MG` is an ERC721-compatible collection that mints **giftcode NFTs** with on-chain encrypted payloads and a redeem-to-soulbound flow.

At a high level:

1. **Mint (backend)**

   - Generate giftcode.
   - Encrypt it:
     - Either AES+FHE (hybrid mode), or
     - Pure-FHE (giftcode directly encrypted).
   - Call `mintGiftcode(...)` with:
     - `uri` – public metadata URL.
     - `encKey` – FHE ciphertext (`InEuint128`).
     - `cipherRef` – optional pointer to ciphertext (hex/IPFS/URL).

2. **Mint (on-chain)**

   - Contract mints a standard ERC721 token.
   - Stores:
     - `_encKey[tokenId]` – FHE ciphertext (`euint128`).
     - `_cipherRef[tokenId]` – string reference to ciphertext (optional).
   - No user addresses are allowed to decrypt yet.

3. **Redeem → Soulbound**

   - Holder calls `redeemToSoulbound(tokenId)`.
   - Contract:
     - Marks `_redeemed[tokenId] = true` and blocks transfers.
     - Calls `FHE.allow(_encKey[tokenId], msg.sender)`.

4. **Decrypt (off-chain with @cofhe/sdk)**
   - SBT holder:
     - Reads `encryptedKey(tokenId)` and `cipherRef(tokenId)`.
     - Uses `decryptForView` with `@cofhe/sdk` to decrypt the FHE handle.
     - Either:
       - Gets the AES key (AES+FHE mode) and uses it to decrypt `cipherRef`'s ciphertext, or
       - Gets the giftcode directly (pure-FHE mode).

Only addresses that have been allowed by `FHE.allow` can successfully decrypt.

---

### Example on-chain view for one ERC721MG token

For `tokenId = 42` in AES+FHE mode, an explorer or script might see:

```text
tokenURI(42)      = "https://metadata.mogate.xyz/erc721mg/42.json"   // public NFT metadata
cipherRef(42)     = "0x5af3..."                                       // AES ciphertext (hex) or IPFS/URL string
encryptedKey(42)  = 812345678901234567890123456789012345n             // FHE(AES key) handle
isRedeemed(42)    = false                                              // still transferable, code hidden from all
```

After the holder calls `redeemToSoulbound(42)`:

```text
isRedeemed(42)    = true                                 // now soulbound
FHE ACL           = { holderAddress ⇒ can decrypt _encKey[42] }
```

- Observers still see only ciphertexts and public metadata.
- Only the **current SBT holder** can use CoFHE to actually view the giftcode.

### What is public vs private per `tokenId`?

For each `tokenId` the contract currently stores:

- **Public on-chain:**

  - `tokenURI(tokenId)` → standard NFT metadata URL (OpenSea-compatible, always public).
  - `cipherRef(tokenId)` → optional reference to the ciphertext payload (IPFS CID, HTTPS URL, or on-chain hex string).
  - `encryptedKey(tokenId)` → FHE ciphertext handle (`euint128` value returned by `encryptedKey`).

- **Private (never on-chain in plaintext):**
  - The **giftcode string** itself.
  - The **plaintext AES key** (in AES+FHE mode).
  - Who can decrypt what, enforced off-chain by the FHE ACL (`FHE.allow(...)`).

Anyone who knows `tokenId` can call:

```solidity
cipherRef(tokenId);
encryptedKey(tokenId);
tokenURI(tokenId);
```

They only get **pointers + ciphertext**, never the giftcode. Knowing `tokenId` is **not** enough to decrypt, because FHE decryption is guarded by the ACL, not by "knowing the ciphertext".

### NFT vs SBT visibility

- **NFT (pre-redeem):**

  - Fully transferable ERC721.
  - Giftcode is **hidden from everyone**, including the current owner.
  - Contract does not call `FHE.allow` for any EOA yet, so no address has decrypt rights.

- **SBT (post-redeem):**

  - Holder calls `redeemToSoulbound(tokenId)`.
  - Contract marks the token as redeemed and blocks transfers (soulbound behaviour).
  - Contract grants FHE decrypt rights **only** to the current holder:

    ```solidity
    FHE.allow(_encKey[tokenId], msg.sender);
    ```

  - The SBT holder can now use `@cofhe/sdk` (`decryptForView`) to obtain the secret.

This matches the intended semantics:

- **NFT:** hidden from everyone (even the owner).
- **SBT:** only the holder can see the giftcode.

### Pure-FHE mode (no AES)

For some flows a simpler "FHE-only" pattern is enough:

- Encode the **giftcode itself** into a `uint128`.
- Use `@cofhe/sdk` to FHE-encrypt that value.
- Mint with `cipherRef = ""` and treat `_encKey[tokenId]` as `FHE(giftcode)` instead of `FHE(AES key)`.
- On redeem:
  - Contract calls `FHE.allow(_encKey[tokenId], holder)`.
  - Holder uses `decryptForView` to read the giftcode directly.

**Trade-offs:**

- **Pros:**
  - No AES logic, no IPFS required for short codes.
  - One ciphertext per giftcode, easier to reason about.
- **Cons:**
  - Limited by `uint128` encoding (short strings / custom encoding only).
  - Less convenient for large or structured payloads.

The same `ERC721MG` contract supports both AES+FHE and pure-FHE; the difference is how off-chain tooling fills `encKey` and `cipherRef`.

### AES + FHE mode (hybrid encryption)

The default flow (scripts `fhe:erc721mg:mint` and `fhe:erc721mg:decrypt`) uses a hybrid pattern:

1. **Off-chain (mint side):**

   - Generate a giftcode string.
   - Generate a random 128-bit AES key.
   - AES-encrypt the giftcode → `CIPHERTEXT_AES`.
   - Store `CIPHERTEXT_AES` somewhere and obtain `cipherRef`:
     - As an IPFS CID (`ipfs://...`), or
     - As an HTTPS URL (`https://...`), or
     - As a hex string stored directly on-chain in `cipherRef(tokenId)`.
   - FHE-encrypt the AES key with `@cofhe/sdk` → `encKey` (`InEuint128`).

2. **Mint (on-chain):**

   - Call `mintGiftcode(to, uri, encKey, cipherRef)`.
   - The contract stores:

     ```solidity
     _encKey[tokenId] = FHE.asEuint128(encKey);   // FHE(AES key)
     _cipherRef[tokenId] = cipherRef;             // pointer to CIPHERTEXT_AES
     ```

3. **Redeem:**

   - Holder calls `redeemToSoulbound(tokenId)`.
   - Contract sets `_redeemed[tokenId] = true` and calls `FHE.allow(_encKey[tokenId], holder)`.

4. **Decrypt (off-chain):**
   - SBT holder uses `fhe:erc721mg:decrypt` (or a frontend with `@cofhe/sdk`).
   - CoFHE nodes return the **AES key** only for the holder address.
   - Holder fetches `CIPHERTEXT_AES` via `cipherRef(tokenId)` and performs a normal AES decrypt to recover the giftcode.

**Why AES?**

- FHE types such as `euint128` are fixed-size; AES lets you encrypt arbitrarily long payloads (QR payloads, long vouchers, JSON) and store only a short key inside FHE.
- Merchant/backends can treat `CIPHERTEXT_AES` as a standard encrypted blob.
- FHE is only used for the small key, which is cheaper and simpler for the FHE network.

### IPFS vs on-chain ciphertext

`cipherRef(tokenId)` is a flexible string slot that can point to the AES ciphertext:

- **On-chain hex string:**

  - Store `CIPHERTEXT_AES` directly as `0x...` in `cipherRef`.
  - Great for short giftcodes, avoids IPFS availability issues.

- **IPFS CID / URL:**
  - Better for large ciphertexts or structured JSON.
  - `cipherRef` holds `ipfs://...` or `https://...`.

In pure-FHE mode `cipherRef` is usually left empty, because all secrecy lives inside the FHE ciphertext itself.

## OTHER STUFF

## Private Vault Marketplace

The `PrivateVaultMarketplace` contract enables trading of vaulted ERC721 tokens while preserving privacy:

- **Listing:** Vault NFT owners can list their vaulted tokens for sale
- **Purchase:** Buyers can purchase vaulted NFTs; the beneficial ownership transfers privately within the vault
- **Privacy:** Only the vault address is visible on-chain; real buyer/seller identities remain encrypted

## Raffle Systems

For complete raffle implementations, see:

- **Transparent Raffle (V1):** https://github.com/dellwatson/moga-mogate/tree/evm-network
- **Darkpool Raffle (V2):**
