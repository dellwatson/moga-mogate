# Offchain Mock Data Structure

Complete backend/database structure for RWA Raffle & Direct-Sell platform.

## 📁 Files Overview

### 1. `companies.json`
**Corporate entities** that create raffles and sell RWA NFTs.

**Companies:**
- **Tixia** - Indonesian OTA (Online Travel Agency)
- **Emiless** - US-based premium flight booking platform
- **Tiamond** - Swiss luxury goods company (diamonds, watches, jewelry)

**Fields:**
- Company info (name, legal name, country, registration)
- KYC verification level and documents
- Wallet addresses
- Collections (with program addresses and metadata URIs)
- Contact info and socials
- Stats (total raffles, volume, rating)

---

### 2. `raffles-ongoing.json`
**Active raffles** with significant time remaining (15+ days).

**Examples:**
- Emirates First Class DXB→JFK ($15k value, 1847/2000 tickets sold)
- Rolex Daytona Platinum ($75k value, 892/2000 tickets sold)
- Singapore Airlines Suites SIN→LAX ($18k value, 1456/2000 tickets sold)

**Fields:**
- NFT details (mint, metadata, image, collection)
- Creator (company info)
- Pricing (value, ticket price, tickets sold/remaining)
- Timeline (start, end, time remaining)
- Participants (total users, top buyers with ticket numbers)
- Program data (PDAs, escrow accounts)
- Metadata (featured, category, tags, views, favorites)

---

### 3. `raffles-ending-soon.json`
**Almost-due raffles** ending in hours or days.

**Examples:**
- $3k Premium Economy Credit (18 hours remaining, 1923/2000 tickets)
- Burj Al Arab Royal Suite (36 hours remaining, 1867/2000 tickets)
- 5ct Diamond Necklace (82 hours remaining, 1789/2000 tickets)

**Additional Fields:**
- `urgency` level (high/medium)
- Countdown timers

---

### 4. `raffles-finished.json`
**Completed raffles** with winners (or expired).

**Examples:**
- $10k First Class Credit - **WINNER: WinnerUserA** (won with 3 tickets, claimed)
- Patek Philippe Nautilus - **WINNER: WinnerUserB** (won with 50 tickets, claimed)
- Qatar Business DOH→LHR - **WINNER: WinnerUserC** (won with 8 tickets, unclaimed)

**Winner Fields:**
- Wallet address
- Winning ticket number
- Tickets owned
- Win probability %
- Claimed status and timestamp
- NFT transfer status

**Result Types:**
- `max_tickets_reached` - All tickets sold
- `time_expired_partial` - Time expired with remaining tickets

---

### 5. `raffles-batch.json`
**Batch raffles** - Multiple NFTs raffled sequentially.

#### Type 1: Same NFT (SFT)
**Example:** 8x $8k Business Class Credits
- Batch 1: ✅ Completed (winner claimed)
- Batch 2: 🔄 Active (1234/2000 tickets)
- Batches 3-8: ⏳ Pending (activate after previous completes)

#### Type 2: Mixed NFTs (1/1)
**Example:** 5x Different Luxury Items
- Batch 1: 🔄 Active - Rolex Daytona (678/2000 tickets)
- Batch 2: ⏳ Pending - Patek Nautilus
- Batch 3: ⏳ Pending - Diamond Necklace
- Batch 4: ⏳ Pending - Hermès Birkin
- Batch 5: ⏳ Pending - Rolex Daytona #2

**Use Cases:**
- Companies can deploy multiple quantities easily
- Each batch = separate raffle with separate winner
- Auto-activates next batch after previous completes
- Admin dashboard tracks all batches

---

### 6. `direct-sell-listings.json`
**Marketplace listings** for direct purchase (no raffle).

#### Listing Types:

**A. Resales from Winners**
Winners reselling their won NFTs:

1. **$10k First Class Credit** - Listed at $3k (70% discount!)
   - Winner spent 18 MOGA (3 tickets)
   - Selling for 3000 MOGA
   - Profit: 2982 MOGA
   - Reason: "Quick sale - need liquidity"

2. **Patek Philippe Nautilus** - Listed at $4k (97% discount!)
   - Winner spent 5000 MOGA (50 tickets)
   - Selling for 4000 MOGA
   - Loss: -1000 MOGA
   - Reason: "Competing with another winner at $5k"
   - Has competing listing from another winner

3. **Burj Al Arab Royal Suite** - Listed at $8k (82% discount)
   - Winner spent 3000 MOGA (100 tickets)
   - Selling for 8000 MOGA
   - Profit: 5000 MOGA
   - Reason: "Can't travel in 2025"

**B. Direct from Companies**
Companies selling directly (skip raffle):

4. **Four Seasons Maldives** - Listed at $32k (8.6% discount)
   - Direct sale from Tixia
   - Reason: "Skip the raffle, buy now!"

**C. Sold Listings**
5. **$5k Business Credit** - SOLD for $1.5k
   - Winner spent 30 MOGA
   - Sold for 1500 MOGA
   - Profit: 1470 MOGA
   - Sold in 28 hours!

**Fields:**
- Listing type (resale vs direct)
- Original raffle info (for resales)
- Seller info (wallet, username, rating)
- Buyer info (for sold items)
- Pricing (value, listing price, discount %, profit/loss)
- Timeline (listed, sold, expires)
- Competing listings (if any)
- Program data (PDAs, escrow)

---

## 🎯 Key Features

### Raffle States
- **Active** - Currently accepting tickets
- **Completed** - Winner selected, may be claimed/unclaimed
- **Pending** - In batch queue, not yet started

### Ticket System
- Each raffle has numbered tickets (1 to N)
- Users can buy multiple tickets
- Ticket numbers stored per user
- Example: User bought tickets [456, 789, 1234]

### Batch Raffle Logic
1. Admin creates batch with N NFTs
2. Batch 1 starts immediately
3. When Batch 1 completes → Batch 2 auto-starts
4. Continues until all batches complete
5. Each batch = separate winner

### Direct-Sell Economics
- Winners can flip for profit/loss
- Price competition between winners
- Companies can sell directly
- Buyers get instant purchase (no raffle wait)

---

## 📊 Database Schema Suggestions

### Collections to Create:
```
companies
raffles
raffle_participants
raffle_tickets
batch_raffles
direct_sell_listings
transactions
users
```

### Indexes Needed:
- `raffles.status` + `raffles.end_time` (for ending-soon queries)
- `raffles.creator.company_id` (company's raffles)
- `raffle_participants.wallet_address` (user's raffles)
- `direct_sell_listings.status` + `direct_sell_listings.pricing.listing_price_usd` (marketplace sorting)

---

## 🚀 API Endpoints Suggestions

### Raffles
- `GET /raffles?status=active&sort=ending_soon`
- `GET /raffles?status=completed&has_winner=true`
- `GET /raffles/:id`
- `GET /raffles/batch/:batch_id`
- `POST /raffles/:id/buy-tickets`

### Direct-Sell
- `GET /marketplace?type=resale&sort=price_asc`
- `GET /marketplace?seller_type=company`
- `GET /marketplace/:listing_id`
- `POST /marketplace/:listing_id/purchase`

### Companies
- `GET /companies`
- `GET /companies/:id`
- `GET /companies/:id/raffles`
- `GET /companies/:id/collections`

### Users
- `GET /users/:wallet/raffles` (participated)
- `GET /users/:wallet/wins` (won raffles)
- `GET /users/:wallet/listings` (marketplace listings)

---

## 📈 Stats & Analytics

### Platform-Wide:
- Total raffles created: 240+
- Total volume: $15M+
- Active users: 2,500+
- Completed raffles: 180+
- Active listings: 15+

### Per Company:
- Tixia: 45 raffles, $1.25M volume
- Emiless: 128 raffles, $4.85M volume
- Tiamond: 67 raffles, $8.92M volume

---

## 🎨 Frontend Components Needed

### Carousels:
1. **Featured Raffles** (high-value items)
2. **Ending Soon** (urgency)
3. **Recently Completed** (show winners)
4. **Batch Raffles** (multi-item deals)
5. **Hot Deals** (marketplace steals)

### Filters:
- Category (travel, luxury)
- Status (active, ending-soon, completed)
- Price range
- Company
- Time remaining

### User Dashboard:
- My Tickets (active raffles)
- My Wins (claimed/unclaimed)
- My Listings (marketplace)
- Transaction History

---

## 🔐 Security Notes

- All NFTs escrowed on-chain
- Winner selection uses VRF (Verifiable Random Function)
- KYC verification for companies
- Escrow accounts for marketplace
- Multi-sig for high-value items

---

## 📝 Next Steps

1. **Backend**: Implement database schema
2. **API**: Build REST/GraphQL endpoints
3. **Smart Contracts**: Deploy raffle + direct-sell programs
4. **Frontend**: Build UI components
5. **Testing**: Populate with mock data
6. **Launch**: Start with verified companies

---

Generated: 2025-11-15
