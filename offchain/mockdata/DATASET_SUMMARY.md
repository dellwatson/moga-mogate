# Massive Raffle Dataset Summary

Generated: 2025-11-15

## 📊 Dataset Overview

### Total Raffles: **652**
- ✅ **120 Completed** raffles (Oct 1 - Nov 14, 2025)
- 🔄 **532 Active** raffles (Nov 15 - Dec 20, 2025)
  - 🔥 **15 Ending Soon** (within 5 days)
  - ⏳ **517 Ongoing** (5+ days remaining)

### Total Marketplace Listings: **116**
- 🔄 **~93 Active** listings
- ✅ **~23 Sold** listings
- 💼 **30 Direct from Companies**
- 🎁 **86 Resales from Winners**

---

## 📁 Files Generated

### 1. `raffles-completed-all.json` (120 raffles)
**Past raffles with winners**

**Date Range:** Oct 1 - Nov 14, 2025

**Characteristics:**
- All tickets sold (100% sold out)
- Winners selected
- 80% claimed, 20% unclaimed
- Each raffle has winner details:
  - Wallet address
  - Winning ticket number
  - Tickets owned
  - Win probability %
  - Claimed status

**Example:**
```json
{
  "raffle_id": "raffle_000001",
  "status": "completed",
  "nft": {
    "name": "Burj Al Arab - Royal Suite 3 Nights #19"
  },
  "pricing": {
    "estimated_value_usd": 45000,
    "ticket_requirement": 54000,
    "tickets_sold": 54000,
    "tickets_remaining": 0
  },
  "winner": {
    "wallet_address": "Winner1Wa11et...",
    "winning_ticket_number": 12345,
    "tickets_owned": 15,
    "claimed": true
  }
}
```

---

### 2. `raffles-ongoing-all.json` (517 raffles)
**Active raffles with 5+ days remaining**

**Date Range:** Nov 15 - Dec 20, 2025

**Characteristics:**
- 30-90% tickets sold
- Various durations (5-25 days)
- Distributed across all 35 days
- 10-20 raffles per day

**Ticket Requirements:**
- Economy flights: ~1,800 tickets ($1,500 value × 1.2)
- Premium Economy: ~3,600 tickets ($3,000 value × 1.2)
- Business Class: ~9,600 tickets ($8,000 value × 1.2)
- First Class: ~18,000 tickets ($15,000 value × 1.2)
- Hotels: ~6,000-54,000 tickets
- Luxury items: ~90,000-180,000 tickets

**Example:**
```json
{
  "raffle_id": "raffle_000122",
  "status": "active",
  "nft": {
    "name": "Four Seasons Maldives - 7 Night Overwater Villa #16"
  },
  "pricing": {
    "estimated_value_usd": 35000,
    "ticket_requirement": 42000,
    "tickets_sold": 25200,
    "tickets_remaining": 16800
  },
  "timeline": {
    "start_time": "2025-11-15T16:21:10.200Z",
    "end_time": "2025-12-06T16:21:10.200Z",
    "duration_days": 21
  }
}
```

---

### 3. `raffles-ending-soon-all.json` (15 raffles)
**Active raffles ending within 5 days**

**Date Range:** Nov 15 - Nov 20, 2025

**Characteristics:**
- High urgency
- 1-4 days remaining
- 60-95% tickets sold
- Featured on homepage

**Example:**
```json
{
  "raffle_id": "raffle_000124",
  "status": "active",
  "nft": {
    "name": "Patek Philippe Nautilus 5711/1A - Blue Dial #24"
  },
  "pricing": {
    "estimated_value_usd": 150000,
    "ticket_requirement": 180000,
    "tickets_sold": 135000,
    "tickets_remaining": 45000
  },
  "timeline": {
    "end_time": "2025-11-18T12:47:27.324Z",
    "duration_days": 3
  }
}
```

---

### 4. `marketplace-listings-all.json` (116 listings)
**Direct-sell marketplace**

**Types:**
- **Resales (86):** Winners reselling their prizes
- **Direct Sales (30):** Companies selling directly

**Pricing:**
- Resales: 50-90% discount (quick flips)
- Direct Sales: 5-20% discount

**Status:**
- ~80% Active
- ~20% Sold

**Example Resale:**
```json
{
  "listing_id": "listing_000042",
  "type": "resale",
  "status": "active",
  "nft": {
    "name": "$10000 First Class Credit - Voucher #001"
  },
  "seller": {
    "wallet_address": "Winner42Wa11et...",
    "username": "User_abc123"
  },
  "original_raffle": {
    "raffle_id": "raffle_000042",
    "won_at": "2025-11-10T23:59:59Z",
    "winning_ticket_number": 1234,
    "tickets_owned": 5
  },
  "pricing": {
    "estimated_value_usd": 10000,
    "listing_price_usd": 3000,
    "discount_percentage": 70
  }
}
```

**Example Direct Sale:**
```json
{
  "listing_id": "listing_direct_000001",
  "type": "direct_from_company",
  "status": "active",
  "seller": {
    "company_id": "company_emiless_001",
    "company_name": "Emiless"
  },
  "pricing": {
    "estimated_value_usd": 15000,
    "listing_price_usd": 13500,
    "discount_percentage": 10
  }
}
```

---

## 🎯 Key Features

### Ticket System
- **1 MOGA+ = 1 USD**
- Ticket requirement = estimated_value_usd × 1.2 (20% markup)
- Each user can buy multiple tickets
- Tickets numbered 1 to N

### NFT Variations
- Each NFT metadata can have up to 30 variants
- Same metadata, different mint addresses
- Allows multiple raffles of same item type

### Raffle Distribution
**By Category:**
- Flights: ~60%
- Hotels: ~15%
- Luxury: ~25%

**By Company:**
- Tixia: ~33%
- Emiless: ~33%
- Tiamond: ~33%

**By Duration:**
- 1-4 days: ~3% (ending soon)
- 5-10 days: ~30%
- 11-20 days: ~50%
- 21-25 days: ~17%

---

## 💰 Economics

### Raffle Economics
```
Example: $10,000 First Class Credit
- Estimated Value: $10,000
- Ticket Requirement: 12,000 tickets
- Ticket Price: 1 MOGA+ = $1
- Total Pot: $12,000
- Platform Profit: $2,000 (20%)
```

### Marketplace Economics
```
Example: Winner Resale
- Won with: 5 tickets = $5 spent
- NFT Value: $10,000
- Listed at: $3,000 (70% discount)
- Winner Profit: $2,995
- Buyer Savings: $7,000 (70% off)
```

---

## 📈 Statistics

### Completed Raffles (120)
- Total tickets sold: ~6.5M tickets
- Total pot value: ~$6.5M USD
- Average tickets per raffle: ~54,000
- Average value per raffle: ~$54,000

### Active Raffles (532)
- Total ticket capacity: ~28M tickets
- Current tickets sold: ~16M (60% avg)
- Total pot value: ~$16M USD
- Remaining capacity: ~$12M USD

### Marketplace (116 listings)
- Total listed value: ~$5.8M USD
- Average discount: 65%
- Total asking price: ~$2M USD
- Potential buyer savings: ~$3.8M USD

---

## 🔍 Query Examples

### Find High-Value Raffles
```javascript
const highValue = raffles.filter(r => 
  r.pricing.estimated_value_usd >= 100000
)
```

### Find Almost Sold Out
```javascript
const almostSold = raffles.filter(r => 
  r.pricing.tickets_sold / r.pricing.ticket_requirement > 0.9
)
```

### Find Best Marketplace Deals
```javascript
const bestDeals = listings
  .filter(l => l.status === 'active')
  .sort((a, b) => b.pricing.discount_percentage - a.pricing.discount_percentage)
  .slice(0, 10)
```

### Find Unclaimed Prizes
```javascript
const unclaimed = completedRaffles.filter(r => 
  r.winner && !r.winner.claimed
)
```

---

## 🚀 Usage

### Import in Node.js
```javascript
import completedRaffles from './raffles-completed-all.json'
import ongoingRaffles from './raffles-ongoing-all.json'
import endingSoonRaffles from './raffles-ending-soon-all.json'
import marketplaceListings from './marketplace-listings-all.json'

// Get all active raffles
const allActive = [...ongoingRaffles, ...endingSoonRaffles]

// Get featured raffles
const featured = allActive.filter(r => r.metadata.featured)

// Get raffles by category
const flightRaffles = allActive.filter(r => r.metadata.category === 'flights')
```

### Database Import
```sql
-- PostgreSQL COPY command
COPY raffles FROM '/path/to/raffles-completed-all.json' WITH (FORMAT json);
COPY raffles FROM '/path/to/raffles-ongoing-all.json' WITH (FORMAT json);
COPY direct_sell_listings FROM '/path/to/marketplace-listings-all.json' WITH (FORMAT json);
```

---

## 📝 Notes

- All timestamps in ISO 8601 format (UTC)
- Wallet addresses are mock addresses
- Mint addresses are unique per variant
- Program PDAs are mock addresses
- All data is realistic and interconnected
- Ready for production use with real addresses

---

## 🎉 Ready to Use!

This dataset provides:
- ✅ 652 raffles spanning 75 days
- ✅ 116 marketplace listings
- ✅ Realistic ticket sales (30-100%)
- ✅ Complete winner information
- ✅ Proper pricing (1 MOGA+ = 1 USD)
- ✅ Ticket requirements (value × 1.2)
- ✅ Multiple variants per NFT
- ✅ All categories (flights, hotels, luxury)
- ✅ All companies (Tixia, Emiless, Tiamond)

**Perfect for:**
- Backend API development
- Frontend UI testing
- Database population
- Demo presentations
- Load testing

---

Generated by: `scripts/generate-massive-raffles.ts`
