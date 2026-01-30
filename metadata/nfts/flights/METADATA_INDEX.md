# Flight NFT Metadata Index

## Overview
Total Modes: 15 (12 SFTs + 3 1/1s)
Total Supply: 12,000+ NFTs

## Rarity Tiers & Scoring

| Rarity | Score Range | Supply Range | Class Types |
|--------|-------------|--------------|-------------|
| Common | 10-20 | 1500-2000 | Economy, Flexible Credits |
| Uncommon | 25-40 | 800-1200 | Economy Regional, Premium Economy |
| Rare | 65-75 | 350-500 | Business Class |
| Epic | 85-90 | 200-250 | First Class, Premium Routes |
| Legendary | 95-100 | 1 each | Specific First/Suites Bookings |

## SFT Flight Credits (12 modes)

### Common Tier (3,500 supply)
1. **$500 Any Airline** - Score: 10, Supply: 2000
   - Any class, any airline, worldwide
   - File: `sft-credit-500-any.json`

2. **$2000 Southeast Asia** - Score: 20, Supply: 1500
   - Flexible class, SEA region only
   - File: `sft-credit-2000-southeast-asia.json`

### Uncommon Tier (3,900 supply)
3. **Economy Indonesia Domestic** - Score: 25, Supply: 1200
   - Economy only, Indonesia routes
   - File: `sft-economy-domestic-indonesia.json`

4. **Economy Asia (Exclude China)** - Score: 30, Supply: 1000
   - Economy only, Asia except China
   - File: `sft-economy-asia-exclude-china.json`

5. **Economy Worldwide (Exclude USA & China)** - Score: 35, Supply: 900
   - Economy only, worldwide except USA/China
   - File: `sft-economy-exclude-usa-china.json`

6. **Premium Economy USA** - Score: 40, Supply: 800
   - Premium Economy, USA domestic
   - File: `sft-premium-economy-usa.json`

### Rare Tier (1,150 supply)
7. **$8000 Business Class** - Score: 65, Supply: 500
   - Business class, exclude Qatar
   - File: `sft-credit-8000-business.json`

8. **Business Europe Round Trip** - Score: 70, Supply: 400
   - Business class, Europe domestic round trip
   - File: `sft-business-roundtrip-europe.json`

9. **Business Transatlantic** - Score: 75, Supply: 350
   - Business class, USA ↔ Europe
   - File: `sft-business-transatlantic.json`

### Epic Tier (650 supply)
10. **First Class Middle East** - Score: 88, Supply: 250
    - First class, Middle East routes, premium airlines
    - File: `sft-first-class-middle-east.json`

11. **$15000 First Class Premium** - Score: 90, Supply: 200
    - First class, premium airlines only (Emirates, Singapore, Qatar, Etihad, ANA)
    - File: `sft-first-class-15000.json`

## 1/1 Specific Bookings (3 modes)

### Legendary Tier (3 unique)
12. **Qatar Business DOH-LHR** - Score: 85, Supply: 1
    - Qatar Airways, Business, Round Trip
    - File: `1of1-qatar-business-roundtrip.json`

13. **ANA First NRT-LHR** - Score: 95, Supply: 1
    - ANA, First Class, Japanese Kaiseki
    - File: `1of1-ana-first-nrt-lhr.json`

14. **Emirates First DXB-JFK** - Score: 98, Supply: 1
    - Emirates A380, First Class, Shower Spa
    - File: `1of1-emirates-first-dxb-jfk.json`

15. **Singapore Suites SIN-LAX** - Score: 100, Supply: 1
    - Singapore Airlines A380, Suites Class, Double Bed
    - File: `1of1-singapore-suites-sin-lax.json`

## GitHub Raw URLs

Base URL: `https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/`

Example:
```
https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/sft-credit-500-any.json
```

## Total Supply Calculation

| Tier | Modes | Total Supply |
|------|-------|--------------|
| Common | 2 | 3,500 |
| Uncommon | 4 | 3,900 |
| Rare | 3 | 1,250 |
| Epic | 2 | 450 |
| Legendary | 4 | 4 |
| **TOTAL** | **15** | **9,104** |

Note: Can easily scale to 12,000+ by increasing supply per mode.

## Rarity Distribution Logic

- **First Class / Suites** → Highest rarity (85-100)
- **Business Class** → Rare/Epic (65-90)
- **Premium Economy** → Uncommon (40)
- **Economy** → Common/Uncommon (10-35)
- **Regional Restrictions** → Increases rarity slightly
- **Specific Bookings (1/1)** → Always Legendary (85-100)
- **Fixed Credits** → Lower rarity than unlimited
