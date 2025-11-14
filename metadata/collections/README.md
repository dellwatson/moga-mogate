# NFT Collections

## 📦 All Collections (5 total)

### 1. Shared 1/1 - Marketplace Unique Items
**File**: `shared-1of1.json`  
**Symbol**: MOGATE-1OF1  
**Fee**: 2.5%  
**Type**: Unique (1/1) NFTs from curated creators

```bash
bun run scripts/2-create-prize-collection.ts shared-1of1
```

### 2. Shared SFT - Marketplace Credits
**File**: `shared-sft.json`  
**Symbol**: MOGATE-SFT  
**Fee**: 2.5%  
**Type**: Platform credits and vouchers (Semi-Fungible)

```bash
bun run scripts/2-create-prize-collection.ts shared-sft
```

### 3. Luxury RWA
**File**: `luxury.json`  
**Symbol**: MOGATE-LUX  
**Fee**: 5%  
**Type**: High-end luxury items (watches, jewelry, handbags)

```bash
bun run scripts/2-create-prize-collection.ts luxury
```

### 4. Travel 1/1 - Unique Bookings
**File**: `travel-1of1.json`  
**Symbol**: MOGATE-TRAVEL  
**Fee**: 0%  
**Type**: Specific flight/hotel bookings with booking IDs

```bash
bun run scripts/2-create-prize-collection.ts travel-1of1
```

### 5. Travel SFT - Credits
**File**: `travel-sft.json`  
**Symbol**: MOGATE-CREDIT  
**Fee**: 0%  
**Type**: Flight and hotel credits (Semi-Fungible)

```bash
bun run scripts/2-create-prize-collection.ts travel-sft
```

## 🎨 Collection Images

All collections now use **placehold.co** for working placeholder images:

| Collection | Image URL | Color |
|------------|-----------|-------|
| Shared 1/1 | `placehold.co/.../Mogate+1of1` | Purple (#8b5cf6) |
| Shared SFT | `placehold.co/.../Mogate+Credits` | Blue (#3b82f6) |
| Luxury | `placehold.co/.../Mogate+Luxury` | Gold (#d4af37) |
| Travel 1/1 | `placehold.co/.../Travel+Bookings` | Blue (#3b82f6) |
| Travel SFT | `placehold.co/.../Travel+Credits` | Sky Blue (#0ea5e9) |

## 📊 Collection Breakdown

### By Category
- **Marketplace**: 2 collections (shared-1of1, shared-sft)
- **Travel**: 2 collections (travel-1of1, travel-sft)
- **Luxury**: 1 collection (luxury)

### By Token Type
- **1/1 (Unique)**: 3 collections
- **SFT (Semi-Fungible)**: 2 collections

### By Fee Structure
- **0% fee**: Travel collections (2)
- **2.5% fee**: Marketplace collections (2)
- **5% fee**: Luxury collection (1)

## 🚀 Create All Collections

```bash
# Marketplace
bun run scripts/2-create-prize-collection.ts shared-1of1
bun run scripts/2-create-prize-collection.ts shared-sft

# Travel
bun run scripts/2-create-prize-collection.ts travel-1of1
bun run scripts/2-create-prize-collection.ts travel-sft

# Luxury
bun run scripts/2-create-prize-collection.ts luxury
```

## 📝 Collection Metadata Structure

Each collection JSON includes:
- `name` - Display name
- `symbol` - Token symbol
- `description` - Full description
- `image` - Collection image URL
- `external_url` - Link to platform
- `attributes` - Collection traits

## 🔗 GitHub URLs

Once committed, collections will be available at:
```
https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/collections/[filename].json
```

## ✅ Status

- [x] All 5 collection metadata files created
- [x] Working placeholder images configured
- [x] Script updated with all collections
- [x] Ready for devnet testing

## 📌 Notes

- **Devnet**: Using placeholder images (placehold.co)
- **Mainnet**: Replace with real collection artwork
- **Fees**: Configurable in script, stored on-chain
- **Authority**: Collection update authority = wallet that creates it
