# Quick Start - Massive Raffle Dataset

## ✅ What You Have

### 652 Raffles
- **120 completed** (with winners)
- **532 active** (15 ending soon, 517 ongoing)
- **Oct 1 - Dec 20, 2025** (80 days)
- **10-20 raffles per day**

### 116 Marketplace Listings
- **81 active**, 35 sold
- **77 resales** from winners
- **39 direct sales** from companies

### $13.45M Total Value
- **16.14M tickets** capacity
- **10.68M tickets** sold (66%)
- **1 MOGA+ = 1 USD**

---

## 📁 Files

```
offchain/mockdata/
├── raffles-completed-all.json      (120 raffles)
├── raffles-ongoing-all.json        (517 raffles)
├── raffles-ending-soon-all.json    (15 raffles)
├── marketplace-listings-all.json   (116 listings)
├── companies.json                  (3 companies)
├── database-schema.sql             (PostgreSQL schema)
├── DATASET_SUMMARY.md              (Full documentation)
└── QUICK_START.md                  (This file)
```

---

## 🚀 Usage

### 1. Import to Database

**PostgreSQL/Supabase:**
```sql
-- Create tables
\i offchain/mockdata/database-schema.sql

-- Import data (use your preferred method)
-- Option A: Use pg_bulkload or COPY
-- Option B: Use Node.js script
```

**Node.js Import Script:**
```javascript
import { createClient } from '@supabase/supabase-js'
import completed from './offchain/mockdata/raffles-completed-all.json'
import ongoing from './offchain/mockdata/raffles-ongoing-all.json'
import endingSoon from './offchain/mockdata/raffles-ending-soon-all.json'
import listings from './offchain/mockdata/marketplace-listings-all.json'

const supabase = createClient(URL, KEY)

// Import raffles
await supabase.from('raffles').insert([
  ...completed,
  ...ongoing,
  ...endingSoon
])

// Import listings
await supabase.from('direct_sell_listings').insert(listings)
```

### 2. Query Examples

**Get ending soon raffles:**
```javascript
const endingSoon = await supabase
  .from('raffles')
  .select('*')
  .eq('status', 'active')
  .lt('end_time', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString())
  .order('end_time', { ascending: true })
```

**Get hot marketplace deals:**
```javascript
const hotDeals = await supabase
  .from('direct_sell_listings')
  .select('*')
  .eq('status', 'active')
  .gt('discount_percentage', 50)
  .order('discount_percentage', { ascending: false })
  .limit(10)
```

**Get user's raffles:**
```javascript
const userRaffles = await supabase
  .from('raffle_participants')
  .select('*, raffles(*)')
  .eq('wallet_address', userWallet)
```

### 3. API Endpoints

**Recommended structure:**
```
GET  /api/raffles?status=active&sort=ending_soon
GET  /api/raffles/:id
POST /api/raffles/:id/buy-tickets
POST /api/raffles/:id/claim-prize

GET  /api/marketplace?type=resale&sort=price_asc
GET  /api/marketplace/:id
POST /api/marketplace/list
POST /api/marketplace/:id/purchase

GET  /api/companies
GET  /api/companies/:id/raffles

GET  /api/users/:wallet/raffles
GET  /api/users/:wallet/wins
GET  /api/users/:wallet/listings
```

---

## 📊 Data Structure

### Raffle Object
```json
{
  "raffle_id": "raffle_000001",
  "type": "single",
  "status": "active",
  "nft": {
    "mint_address": "...",
    "metadata_uri": "https://...",
    "name": "Emirates First Class DXB→JFK #5",
    "image": "https://...",
    "collection_address": "...",
    "supply": 1
  },
  "creator": {
    "company_id": "company_emiless_001",
    "company_name": "Emiless",
    "wallet_address": "...",
    "is_verified": true
  },
  "pricing": {
    "estimated_value_usd": 15000,
    "ticket_requirement": 18000,
    "tickets_sold": 12000,
    "tickets_remaining": 6000,
    "total_pot_usd": 12000
  },
  "timeline": {
    "created_at": "2025-11-10T08:00:00Z",
    "start_time": "2025-11-10T10:00:00Z",
    "end_time": "2025-11-25T23:59:59Z",
    "completed_at": null,
    "duration_days": 15
  },
  "participants": {
    "total_unique_users": 3600
  },
  "winner": null,
  "program_data": {
    "raffle_pda": "...",
    "escrow_account": "...",
    "program_id": "rwa_raffle_program_v1"
  },
  "metadata": {
    "featured": true,
    "category": "flights",
    "tags": ["first-class", "emirates"],
    "views": 8934,
    "favorites": 456
  }
}
```

### Marketplace Listing Object
```json
{
  "listing_id": "listing_000001",
  "type": "resale",
  "status": "active",
  "nft": { /* same as raffle */ },
  "seller": {
    "wallet_address": "...",
    "username": "User_abc123",
    "verified": true,
    "rating": 4.7
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
  },
  "timeline": {
    "listed_at": "2025-11-11T10:00:00Z",
    "expires_at": "2025-12-11T23:59:59Z"
  },
  "program_data": { /* ... */ },
  "metadata": { /* ... */ }
}
```

---

## 🎯 Key Features

### Ticket System
- **1 MOGA+ = 1 USD** (no price field needed)
- Ticket requirement = value × 1.2 (20% markup)
- Example: $10k NFT → 12,000 tickets required

### NFT Variants
- Each NFT has up to 30 variants
- Same metadata, different mint addresses
- Allows multiple raffles of same type

### Winner Selection
- Completed raffles have winners
- 80% claimed, 20% unclaimed
- Winners can resell on marketplace

### Marketplace Economics
- Resales: 50-90% discount (quick flips)
- Direct sales: 5-20% discount
- Winners profit even with big discounts

---

## 📈 Statistics

```
📊 DATASET STATISTICS

🎰 RAFFLES:
  Total: 652
  ✅ Completed: 120
  🔄 Active: 532
     - 🔥 Ending Soon: 15
     - ⏳ Ongoing: 517

🏪 MARKETPLACE:
  Total Listings: 116
  Active: 81
  Sold: 35
  Resales: 77
  Direct Sales: 39

💰 PRICING:
  Total Ticket Capacity: 16.14M tickets
  Total Tickets Sold: 10.68M tickets
  Total NFT Value: $13.45M USD
  Total Pot Value: $10.68M USD

📅 DATE RANGE:
  From: 2025-10-01
  To: 2025-12-19
  Duration: 80 days

🏷️  CATEGORIES:
  flights: 447 (68.6%)
  hotels: 127 (19.5%)
  luxury: 78 (12.0%)

🏢 COMPANIES:
  Emiless: 244 (37.4%)
  Tixia: 205 (31.4%)
  Tiamond: 203 (31.1%)
```

---

## 🔧 Generate More Data

To regenerate or modify the dataset:

```bash
bun run scripts/generate-massive-raffles.ts
```

Edit the script to:
- Change number of raffles
- Adjust date ranges
- Modify ticket requirements
- Change discount percentages

---

## ✅ Ready to Build!

You now have everything needed to build the platform:

1. ✅ **652 raffles** with realistic data
2. ✅ **116 marketplace listings**
3. ✅ **Database schema** (PostgreSQL)
4. ✅ **3 verified companies**
5. ✅ **26 NFT metadata** files
6. ✅ **Complete documentation**

**Start building your backend API and frontend UI!** 🚀

---

Questions? Check:
- `DATASET_SUMMARY.md` - Full documentation
- `IMPLEMENTATION_GUIDE.md` - Step-by-step guide
- `database-schema.sql` - Database structure
- `README.md` - Original mockdata docs

Generated: 2025-11-15
