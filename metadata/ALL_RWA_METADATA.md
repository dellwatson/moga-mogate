# Complete RWA Metadata Catalog

## 📊 Overview

**Total Categories**: 3 (Flights, Hotels, Luxury)
**Total Metadata Files**: 26
- 18 Flight NFTs (14 SFTs + 7 1/1s)
- 4 Hotel NFTs (2 SFTs + 2 1/1s)
- 4 Luxury NFTs (all 1/1s)

## ✈️ Flight NFTs (18 total)

### SFT Credits (11 modes)
1. `sft-credit-500-any.json` - $500 Any Airline (2,000 supply)
2. `sft-credit-2000-southeast-asia.json` - $2000 SEA (1,500 supply)
3. `sft-economy-domestic-indonesia.json` - Economy Indonesia (1,200 supply)
4. `sft-economy-asia-exclude-china.json` - Economy Asia (1,000 supply)
5. `sft-economy-exclude-usa-china.json` - Economy Worldwide (900 supply)
6. `sft-premium-economy-usa.json` - Premium Economy USA (800 supply)
7. `sft-credit-8000-business.json` - $8000 Business (500 supply)
8. `sft-business-roundtrip-europe.json` - Business Europe RT (400 supply)
9. `sft-business-transatlantic.json` - Business Transatlantic (350 supply)
10. `sft-first-class-middle-east.json` - First Class ME (250 supply)
11. `sft-first-class-15000.json` - $15000 First Class (200 supply)

**SFT Total Supply**: 9,100

### 1/1 Specific Bookings (4 modes)
12. `1of1-qatar-business-roundtrip.json` - Qatar Business DOH-LHR
13. `1of1-ana-first-nrt-lhr.json` - ANA First NRT-LHR
14. `1of1-emirates-first-dxb-jfk.json` - Emirates First DXB-JFK
15. `1of1-singapore-suites-sin-lax.json` - Singapore Suites SIN-LAX

### 1/1 Credit Vouchers (3 modes) **NEW**
16. `1of1-credit-3000-premium-economy.json` - $3000 Premium Economy Voucher #001
17. `1of1-credit-5000-business.json` - $5000 Business Voucher #001
18. `1of1-credit-10000-first.json` - $10000 First Class Voucher #001

## 🏨 Hotel NFTs (4 total)

### SFT Credits (2 modes)
1. `sft-credit-1000-any.json` - $1000 Any Hotel (1,500 supply)
2. `sft-credit-5000-luxury.json` - $5000 5-Star Luxury (300 supply)

**SFT Total Supply**: 1,800

### 1/1 Specific Bookings (2 modes)
3. `1of1-four-seasons-maldives-7nights.json` - Four Seasons Maldives 7N
4. `1of1-burj-al-arab-royal-suite.json` - Burj Al Arab Royal Suite 3N

## 💎 Luxury RWA NFTs (4 total - all 1/1)

### Watches (2 items)
1. `1of1-rolex-daytona-platinum.json` - Rolex Daytona Platinum ($75,000)
2. `1of1-patek-philippe-nautilus.json` - Patek Philippe Nautilus ($150,000)

### Jewelry (1 item)
3. `1of1-diamond-necklace-5ct.json` - 5ct Diamond Necklace VVS1 ($45,000)

### Handbags (1 item)
4. `1of1-hermes-birkin-35.json` - Hermès Birkin 35 Black/Gold ($25,000)

## 📁 Directory Structure

```
metadata/nfts/
├── flights/
│   ├── sft-*.json (11 files)
│   └── 1of1-*.json (7 files)
├── hotels/
│   ├── sft-*.json (2 files)
│   └── 1of1-*.json (2 files)
└── luxury/
    └── 1of1-*.json (4 files)
```

## 🎯 Understanding 1/1 vs SFT

### SFT (Semi-Fungible Token)
- **Same metadata** for all copies
- **maxSupply** defines how many can be minted
- Example: 100 copies of "$500 Flight Credit" all share the same metadata
- Use case: Credits, vouchers, identical items

### 1/1 (Unique NFT)
- **Unique metadata** for each NFT
- **maxSupply = 1**
- Each has unique serial number, booking ID, or item details
- Use case: Specific bookings, luxury items, serialized vouchers

### Example: Minting 100 Identical Credits

**Option A: SFT (Recommended)**
```typescript
// Mint once with maxSupply=100
await mintSFT("sft-credit-500-any.json", 100);
// Result: 100 identical NFTs, same metadata
```

**Option B: 100 Different 1/1s (NOT recommended for identical items)**
```typescript
// Would need 100 different metadata files
await mint1of1("1of1-credit-500-#001.json");
await mint1of1("1of1-credit-500-#002.json");
// ... 98 more files
// Result: 100 unique NFTs, different serial numbers
```

## 💰 Total Value Summary

### Flights
- SFT Credits: ~$50M potential value (9,100 × avg $5,500)
- 1/1 Bookings: ~$150K (4 premium bookings)
- 1/1 Vouchers: $18K (3 vouchers)

### Hotels
- SFT Credits: ~$2.5M potential value (1,800 × avg $1,400)
- 1/1 Bookings: $45K (2 luxury stays)

### Luxury
- Total: $295K (4 items)

**Grand Total Retail Value**: ~$52.9M+ across all NFTs

## 🎨 Rarity Distribution (All Categories)

| Rarity | Score | Flight | Hotel | Luxury | Total Supply |
|--------|-------|--------|-------|--------|--------------|
| Common | 10-20 | 3,500 | 1,500 | 0 | 5,000 |
| Uncommon | 25-40 | 3,900 | 0 | 0 | 3,900 |
| Rare | 60-75 | 1,250 | 300 | 0 | 1,550 |
| Epic | 80-90 | 450 | 0 | 2 | 452 |
| Legendary | 92-100 | 7 | 2 | 2 | 11 |

**Total Supply**: 10,913 NFTs

## 🌐 GitHub URLs

Base URLs:
- Flights: `https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/`
- Hotels: `https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/hotels/`
- Luxury: `https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/luxury/`

## 📝 Metadata Features

All NFTs include:
- ✅ Name, symbol, description
- ✅ Image URL (GitHub-hosted)
- ✅ External URL (emiless.com or mogate.io)
- ✅ Rich attributes (10-15 traits)
- ✅ Rarity scoring
- ✅ Supply information
- ✅ Creator attribution
- ✅ Category classification

## 🎯 Use Cases

### For Raffles
- Mix of common (high supply) and legendary (ultra-rare)
- Clear value proposition for each tier
- Excitement from luxury prizes

### For Marketplace
- SFT credits: Tradeable, divisible inventory
- 1/1 items: Unique collectibles with real value
- Clear redemption path via emiless.com

### For Rewards
- Common tier: Participation rewards
- Rare tier: Achievement unlocks
- Legendary: Grand prizes

## ✅ Next Steps

1. **Commit to GitHub**
   ```bash
   git add metadata/nfts/
   git commit -m "Add complete RWA metadata: flights, hotels, luxury"
   git push origin main
   ```

2. **Create Collection Metadata**
   - Update `collections/` with hotel and luxury collections
   - Similar to travel collections

3. **Create Minting Scripts**
   - `scripts/5-mint-hotel-nfts.ts`
   - `scripts/6-mint-luxury-nfts.ts`

4. **Add Images** (optional for devnet)
   - Create placeholder images
   - Or use real product images for production

## 📞 Redemption

- **Flights & Hotels**: emiless.com
- **Luxury Items**: mogate.io/luxury
- All items: No expiration, perpetual value

---

**Status**: ✅ 26 metadata files ready
**Total Potential Supply**: 10,913 NFTs
**Total Retail Value**: $52.9M+
