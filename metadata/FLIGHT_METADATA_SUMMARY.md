# Flight NFT Metadata Summary

## 🎯 Overview

Created **15 flight modes** with comprehensive metadata for travel NFTs:
- **11 SFT Credits** (Semi-Fungible Tokens) - ~9,100 total supply
- **4 1/1 Bookings** (Unique) - 4 legendary NFTs

Total potential supply: **9,104 NFTs** (easily scalable to 12,000+)

## 📊 Supply Distribution

| Tier | Modes | Supply | % of Total |
|------|-------|--------|------------|
| Common | 2 | 3,500 | 38.4% |
| Uncommon | 4 | 3,900 | 42.8% |
| Rare | 3 | 1,250 | 13.7% |
| Epic | 2 | 450 | 4.9% |
| Legendary | 4 | 4 | 0.04% |
| **TOTAL** | **15** | **9,104** | **100%** |

## 🎨 Rarity Scoring System

### Score Ranges
- **Common**: 10-20 (Economy, flexible credits)
- **Uncommon**: 25-40 (Regional economy, premium economy)
- **Rare**: 65-75 (Business class)
- **Epic**: 85-90 (First class, premium airlines)
- **Legendary**: 95-100 (Specific first/suites bookings)

### Scoring Logic
Base score by class:
- Economy: 10-15
- Premium Economy: 35-40
- Business: 60-70
- First Class: 80-90
- Suites: 95-100

Modifiers:
- **+5-10**: Regional restrictions
- **+10**: Premium airlines only
- **+5**: Round trip
- **+10-15**: Specific airline (Qatar, Emirates, etc.)
- **+20-30**: 1/1 specific booking with booking ID

## 📦 All 15 Modes

### SFT Credits (11 modes)

#### Common (2 modes, 3,500 supply)
1. **$500 Any Airline** - Score: 10, Supply: 2,000
   - Flexible class, any airline, worldwide
   
2. **$2000 Southeast Asia** - Score: 20, Supply: 1,500
   - Flexible class, SEA region

#### Uncommon (4 modes, 3,900 supply)
3. **Economy Indonesia Domestic** - Score: 25, Supply: 1,200
   - Economy only, Indonesia routes
   
4. **Economy Asia (Exclude China)** - Score: 30, Supply: 1,000
   - Economy only, Asia except China
   
5. **Economy Worldwide (Exclude USA & China)** - Score: 35, Supply: 900
   - Economy only, worldwide except USA/China
   
6. **Premium Economy USA** - Score: 40, Supply: 800
   - Premium Economy, USA domestic

#### Rare (3 modes, 1,250 supply)
7. **$8000 Business Class** - Score: 65, Supply: 500
   - Business class, exclude Qatar
   
8. **Business Europe Round Trip** - Score: 70, Supply: 400
   - Business class, Europe domestic RT
   
9. **Business Transatlantic** - Score: 75, Supply: 350
   - Business class, USA ↔ Europe

#### Epic (2 modes, 450 supply)
10. **First Class Middle East** - Score: 88, Supply: 250
    - First class, Middle East routes, premium airlines
    
11. **$15000 First Class Premium** - Score: 90, Supply: 200
    - First class, premium airlines only

### 1/1 Specific Bookings (4 modes)

#### Legendary (4 unique NFTs)
12. **Qatar Business DOH-LHR** - Score: 85
    - Qatar Airways, Business, Round Trip
    - Booking ID: QR-BIZ-2025-001
    
13. **ANA First NRT-LHR** - Score: 95
    - ANA, First Class, Japanese Kaiseki
    - Booking ID: NH-FIRST-2025-001
    
14. **Emirates First DXB-JFK** - Score: 98
    - Emirates A380, First Class, Shower Spa
    - Booking ID: EK-FIRST-2025-001
    
15. **Singapore Suites SIN-LAX** - Score: 100
    - Singapore Airlines A380, Suites, Double Bed
    - Booking ID: SQ-SUITES-2025-001

## 🌐 GitHub URLs

All metadata hosted at:
```
https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/
```

### Example URLs
- SFT: `https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/sft-credit-500-any.json`
- 1/1: `https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/1of1-singapore-suites-sin-lax.json`

## 🎯 Key Features

### Flexibility Modes
- **Fixed Price Credits**: $500, $2000, $8000, $15000
- **Unlimited Credits**: Class/region specific
- **Specific Bookings**: 1/1 with booking IDs

### Class Coverage
- ✅ Economy
- ✅ Premium Economy
- ✅ Business
- ✅ First Class
- ✅ Suites (Singapore Airlines)

### Regional Coverage
- ✅ Worldwide
- ✅ Southeast Asia
- ✅ Indonesia Domestic
- ✅ Asia (with/without China)
- ✅ USA Domestic
- ✅ Europe Domestic
- ✅ Middle East
- ✅ Transatlantic

### Airline Options
- ✅ Any airline
- ✅ Premium only (Emirates, Singapore, Qatar, Etihad, ANA)
- ✅ Specific airlines (Qatar, Emirates, Singapore, ANA)
- ✅ Exclude specific airlines

## 📈 Scaling to 12,000+

Current: 9,104 NFTs
Target: 12,000+ NFTs

**Options:**
1. Increase common tier supplies:
   - $500 credit: 2,000 → 3,500 (+1,500)
   - $2000 SEA: 1,500 → 2,500 (+1,000)
   - Economy Indonesia: 1,200 → 1,900 (+700)
   
2. Add more modes:
   - Economy Middle East
   - Business Asia Pacific
   - Premium Economy Europe
   - First Class Transpacific

## ✅ Next Steps

1. **Push to GitHub**
   ```bash
   git add metadata/
   git commit -m "Add 15 flight NFT metadata modes"
   git push origin main
   ```

2. **Verify URLs**
   ```bash
   # Test a few URLs
   curl https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/sft-credit-500-any.json
   ```

3. **Create Images** (optional for devnet)
   - Add placeholder images to `metadata/images/flights/`
   - Or use GitHub-hosted images later

4. **Update Collection Script**
   - ✅ Already updated to use GitHub URLs
   - ✅ Devnet mode skips Arweave upload

5. **Create Minting Scripts**
   - Script to mint SFT credits with max supply
   - Script to mint 1/1 bookings
   - Use the GitHub metadata URIs

## 🎨 Metadata Attributes

Each NFT includes rich attributes:
- **Type**: Flight Credit / Specific Booking
- **Credit Value**: $500, $2000, etc. or Unlimited
- **Class**: Economy, Premium Economy, Business, First, Suites
- **Airline**: Any, Premium Only, or Specific
- **Region**: Worldwide, SEA, USA, Europe, etc.
- **Trip Type**: One Way, Round Trip
- **Expiration**: Never (all perpetual)
- **Rarity**: Common, Uncommon, Rare, Epic, Legendary
- **Rarity Score**: 10-100
- **Supply**: 1-2000
- **Creator**: emiless.com

## 🔥 Highlights

**Most Common**: $500 Any Airline (2,000 supply, Score: 10)
**Most Rare**: Singapore Suites SIN-LAX (1 supply, Score: 100)
**Best Value**: $15000 First Class (200 supply, Score: 90)
**Most Flexible**: $500 Any Airline (any class, any airline, worldwide)
**Most Exclusive**: All 4 Legendary 1/1 bookings

## 📝 Files Created

```
metadata/
├── collections/
│   ├── travel-sft.json
│   └── travel-1of1.json
└── nfts/
    └── flights/
        ├── README.md
        ├── METADATA_INDEX.md
        ├── sft-credit-500-any.json
        ├── sft-credit-2000-southeast-asia.json
        ├── sft-credit-8000-business.json
        ├── sft-first-class-15000.json
        ├── sft-economy-domestic-indonesia.json
        ├── sft-economy-asia-exclude-china.json
        ├── sft-economy-exclude-usa-china.json
        ├── sft-premium-economy-usa.json
        ├── sft-business-roundtrip-europe.json
        ├── sft-business-transatlantic.json
        ├── sft-first-class-middle-east.json
        ├── 1of1-qatar-business-roundtrip.json
        ├── 1of1-emirates-first-dxb-jfk.json
        ├── 1of1-singapore-suites-sin-lax.json
        └── 1of1-ana-first-nrt-lhr.json
```

Total: **17 JSON files** (2 collections + 15 NFT metadata)
