# Flight NFT Metadata - GitHub Hosted

## Quick Start

All metadata is hosted on GitHub and accessible via raw URLs:

```
https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/[filename].json
```

## 15 Flight Modes Created

### SFT Credits (12 modes) - Total Supply: ~9,100

#### Common Tier (Rarity Score: 10-20)
- `sft-credit-500-any.json` - $500 Any Airline (2000 supply)
- `sft-credit-2000-southeast-asia.json` - $2000 SEA Credit (1500 supply)

#### Uncommon Tier (Rarity Score: 25-40)
- `sft-economy-domestic-indonesia.json` - Economy Indonesia (1200 supply)
- `sft-economy-asia-exclude-china.json` - Economy Asia No China (1000 supply)
- `sft-economy-exclude-usa-china.json` - Economy Worldwide Exclude (900 supply)
- `sft-premium-economy-usa.json` - Premium Economy USA (800 supply)

#### Rare Tier (Rarity Score: 65-75)
- `sft-credit-8000-business.json` - $8000 Business (500 supply)
- `sft-business-roundtrip-europe.json` - Business Europe RT (400 supply)
- `sft-business-transatlantic.json` - Business Transatlantic (350 supply)

#### Epic Tier (Rarity Score: 85-90)
- `sft-first-class-middle-east.json` - First Class Middle East (250 supply)
- `sft-first-class-15000.json` - $15000 First Class Premium (200 supply)

### 1/1 Specific Bookings (4 modes) - Unique NFTs

#### Legendary Tier (Rarity Score: 85-100)
- `1of1-qatar-business-roundtrip.json` - Qatar Business DOH-LHR (Score: 85)
- `1of1-ana-first-nrt-lhr.json` - ANA First NRT-LHR (Score: 95)
- `1of1-emirates-first-dxb-jfk.json` - Emirates First DXB-JFK (Score: 98)
- `1of1-singapore-suites-sin-lax.json` - Singapore Suites SIN-LAX (Score: 100)

## Rarity System

| Class | Rarity Range | Why? |
|-------|--------------|------|
| **Suites** | 100 | Ultra-premium, private suites with double beds |
| **First Class** | 85-98 | Luxury travel, shower spas, premium dining |
| **Business** | 65-75 | Comfortable long-haul, lie-flat seats |
| **Premium Economy** | 40 | Enhanced economy with extra space |
| **Economy** | 10-35 | Standard travel class |

**Modifiers:**
- Specific airline (Qatar, Emirates, etc.) → +10-15 points
- Regional restrictions → +5-10 points
- Round trip → +5 points
- Premium airlines only → +10 points
- 1/1 specific booking → +20-30 points

## Usage in Scripts

### Example: Mint SFT Credit

```typescript
const metadataUri = "https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/sft-credit-500-any.json";

// Mint 2000 copies of $500 credit
await mintSFT({
  uri: metadataUri,
  maxSupply: 2000,
  collection: travelSftCollection
});
```

### Example: Mint 1/1 Booking

```typescript
const metadataUri = "https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/1of1-singapore-suites-sin-lax.json";

// Mint unique booking
await mint1of1({
  uri: metadataUri,
  collection: travel1of1Collection
});
```

## Scaling to 12,000+ Supply

Current total: ~9,100 NFTs

To reach 12,000+:
- Increase common tier supplies (e.g., $500 credit from 2000 → 3000)
- Add more regional variations
- Create more specific routes for 1/1s

## Next Steps

1. **Push to GitHub**
   ```bash
   git add metadata/
   git commit -m "Add flight NFT metadata (15 modes)"
   git push origin main
   ```

2. **Verify URLs work**
   ```bash
   curl https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/sft-credit-500-any.json
   ```

3. **Create placeholder images** (optional for devnet)
   - Upload to `metadata/images/flights/`
   - Or use placeholder service: `https://via.placeholder.com/500x500.png?text=Flight+Credit`

4. **Update minting scripts** to use these URIs

## Benefits

✅ **Free hosting** - No Arweave costs for devnet  
✅ **Easy updates** - Edit JSON and push  
✅ **Version control** - Track all changes  
✅ **Fast** - GitHub CDN is reliable  
✅ **No blockchain tx** - Update metadata anytime  

## Metadata Structure

Each JSON includes:
- `name` - Display name
- `symbol` - Token symbol
- `description` - Full description
- `image` - Image URL (GitHub hosted)
- `external_url` - Link to emiless.com
- `attributes` - Traits for rarity, class, airline, region, etc.
- `properties` - Files, creators, category

## Creator Attribution

All flights created by: **emiless.com**
