# SFT vs 1/1 - Complete Explanation

## 🤔 Your Question

> "If I want to mint 100x the same metadata, will it be created as 1/1?"

**Answer**: No! For 100 identical items, use **SFT** with `maxSupply=100`, not 100 different 1/1s.

## 📦 SFT (Semi-Fungible Token)

### What is it?
- **One metadata file** → **Multiple identical NFTs**
- Like printing 100 copies of the same ticket
- All copies share the same metadata URL

### Example: $500 Flight Credit

**Metadata**: `sft-credit-500-any.json`
```json
{
  "name": "$500 Flight Credit - Any Airline",
  "attributes": [
    { "trait_type": "Credit Value", "value": "$500" },
    { "trait_type": "Supply", "value": 2000 }
  ]
}
```

**Minting**:
```typescript
// Mint ONCE with maxSupply=2000
await metaplex.nfts().create({
  uri: "https://raw.githubusercontent.com/.../sft-credit-500-any.json",
  maxSupply: 2000,  // ← This creates 2000 identical NFTs
});
```

**Result**:
- ✅ 2,000 NFTs created
- ✅ All have the same metadata
- ✅ All show "$500 Flight Credit"
- ✅ Efficient: 1 metadata file for 2,000 NFTs

### When to use SFT?
- ✅ Credits/vouchers with same value
- ✅ Identical items (same product, same specs)
- ✅ Bulk rewards
- ✅ Fungible inventory

## 🎯 1/1 (Unique NFT)

### What is it?
- **One metadata file** → **One unique NFT**
- Each NFT has different details (serial number, booking ID, etc.)
- Not interchangeable

### Example: $5000 Business Credit Vouchers

If you want 100 unique vouchers with serial numbers:

**Metadata File #1**: `1of1-credit-5000-business-#001.json`
```json
{
  "name": "$5000 Business Class Credit - Voucher #001",
  "attributes": [
    { "trait_type": "Voucher ID", "value": "CREDIT-5K-BIZ-001" },
    { "trait_type": "Serial Number", "value": "001" },
    { "trait_type": "Supply", "value": 1 }
  ]
}
```

**Metadata File #2**: `1of1-credit-5000-business-#002.json`
```json
{
  "name": "$5000 Business Class Credit - Voucher #002",
  "attributes": [
    { "trait_type": "Voucher ID", "value": "CREDIT-5K-BIZ-002" },
    { "trait_type": "Serial Number", "value": "002" },
    { "trait_type": "Supply", "value": 1 }
  ]
}
```

**... repeat for #003 to #100**

**Minting**:
```typescript
// Mint 100 times, each with different metadata
for (let i = 1; i <= 100; i++) {
  await metaplex.nfts().create({
    uri: `https://raw.githubusercontent.com/.../1of1-credit-5000-business-${i.toString().padStart(3, '0')}.json`,
    maxSupply: 1,  // ← Each is unique
  });
}
```

**Result**:
- ✅ 100 unique NFTs
- ✅ Each has different serial number
- ✅ Each has unique metadata file
- ⚠️ Requires 100 metadata files

### When to use 1/1?
- ✅ Specific bookings (flight #123, hotel reservation #456)
- ✅ Serialized items (voucher #001, #002, etc.)
- ✅ Luxury items (each watch/jewelry is unique)
- ✅ Limited editions with unique traits

## 🔄 Comparison

### Scenario: 100 identical $500 flight credits

| Aspect | SFT Approach | 1/1 Approach |
|--------|--------------|--------------|
| **Metadata files** | 1 file | 100 files |
| **Minting calls** | 1 call | 100 calls |
| **Metadata content** | All identical | Each has unique serial |
| **NFT names** | All "$500 Flight Credit" | "$500 Credit #001", "#002", etc. |
| **Interchangeable?** | Yes | No (each has unique serial) |
| **Use case** | Identical credits | Serialized vouchers |
| **Recommended?** | ✅ YES | ❌ Only if you need serials |

## 📋 Current Metadata Structure

### Flights - SFT Credits (for identical items)
```
sft-credit-500-any.json          → maxSupply: 2000
sft-credit-2000-southeast-asia.json → maxSupply: 1500
sft-credit-8000-business.json    → maxSupply: 500
```

### Flights - 1/1 Vouchers (serialized)
```
1of1-credit-3000-premium-economy.json  → Serial #001 (unique)
1of1-credit-5000-business.json         → Serial #001 (unique)
1of1-credit-10000-first.json           → Serial #001 (unique)
```

### Flights - 1/1 Bookings (specific reservations)
```
1of1-qatar-business-roundtrip.json     → Booking ID: QR-BIZ-2025-001
1of1-emirates-first-dxb-jfk.json       → Booking ID: EK-FIRST-2025-001
```

## 💡 Recommendations

### For Your Use Case

**If you want 100 identical $5000 business credits:**
```typescript
// Use SFT
await mintSFT("sft-credit-5000-business.json", 100);
```

**If you want 100 unique serialized vouchers:**
```typescript
// Create 100 metadata files, then mint each as 1/1
for (let i = 1; i <= 100; i++) {
  await mint1of1(`1of1-credit-5000-business-${i.toString().padStart(3, '0')}.json`);
}
```

## 🎯 Best Practices

### Use SFT when:
- All items are functionally identical
- No need to track individual serial numbers
- Want efficient metadata management
- Building large supply (100s-1000s)

### Use 1/1 when:
- Each item is truly unique
- Need individual tracking (serials, booking IDs)
- Luxury/collectible items
- Specific reservations or allocations

## 🚀 Quick Decision Tree

```
Do you need to track each NFT individually?
├─ NO → Use SFT
│   └─ Example: 100 identical $500 credits
│
└─ YES → Use 1/1
    ├─ Different items → Create different metadata for each
    │   └─ Example: Rolex, Patek, Hermès (all different)
    │
    └─ Same item, different serials → Create metadata with serial numbers
        └─ Example: Voucher #001, #002, #003...
```

## 📝 Summary

- **SFT** = One metadata → Many identical NFTs (efficient)
- **1/1** = One metadata → One unique NFT (tracking)
- **For 100 identical items** → Use SFT with maxSupply=100
- **For 100 serialized items** → Create 100 1/1 metadata files

The current metadata I created includes both types so you can choose based on your needs!
