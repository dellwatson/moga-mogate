# Implementation Guide - RWA Raffle Platform

Complete guide to implement the backend/offchain system using the mock data structure.

## 📦 What We Have

### ✅ Complete Mock Data
1. **3 Companies** (Tixia, Emiless, Tiamond) with full KYC, collections, socials
2. **3 Ongoing Raffles** (Emirates First, Rolex, Singapore Suites)
3. **3 Ending Soon Raffles** ($3k Credit, Burj Royal, Diamond Necklace)
4. **3 Finished Raffles** (with winners - claimed & unclaimed)
5. **2 Batch Raffles** (8x Business Credits, 5x Mixed Luxury)
6. **6 Direct-Sell Listings** (resales + company direct + sold)
7. **Complete Database Schema** (PostgreSQL/Supabase ready)

### ✅ NFT Metadata
- **26 NFT metadata files** (flights, hotels, luxury)
- **5 Collection metadata files**
- **31 Images** (downloaded from Unsplash, hosted on GitHub)
- All with country flags 🇦🇪 🇺🇸 🇸🇬 🇯🇵 🇬🇧 🇶🇦 🇲🇻

---

## 🚀 Implementation Steps

### Phase 1: Database Setup (Week 1)

#### 1.1 Choose Database
**Recommended:** Supabase (PostgreSQL + Auth + Realtime)
- Free tier: 500MB database
- Built-in auth
- Realtime subscriptions
- REST API auto-generated

**Alternative:** MongoDB Atlas (if prefer NoSQL)

#### 1.2 Run Schema
```bash
# Connect to Supabase/PostgreSQL
psql -h your-db-host -U postgres -d your-db

# Run schema
\i offchain/mockdata/database-schema.sql
```

#### 1.3 Seed Mock Data
```bash
# Import JSON files
node scripts/seed-database.js
```

Create `scripts/seed-database.js`:
```javascript
import { createClient } from '@supabase/supabase-js'
import companies from './offchain/mockdata/companies.json'
import rafflesOngoing from './offchain/mockdata/raffles-ongoing.json'
// ... import all JSON files

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function seed() {
  // Insert companies
  await supabase.from('companies').insert(companies)
  
  // Insert raffles
  await supabase.from('raffles').insert([
    ...rafflesOngoing,
    ...rafflesEndingSoon,
    ...rafflesFinished
  ])
  
  // Insert batch raffles
  await supabase.from('batch_raffles').insert(batchRaffles)
  
  // Insert listings
  await supabase.from('direct_sell_listings').insert(listings)
}

seed()
```

---

### Phase 2: Backend API (Week 2-3)

#### 2.1 Tech Stack
**Recommended:**
- **Framework:** Next.js 14 (App Router) or Express.js
- **ORM:** Prisma or Drizzle
- **Validation:** Zod
- **Auth:** Supabase Auth or NextAuth

#### 2.2 API Routes

**Raffles:**
```typescript
// GET /api/raffles?status=active&sort=ending_soon
// GET /api/raffles/:id
// GET /api/raffles/batch/:batch_id
// POST /api/raffles/:id/buy-tickets
// POST /api/raffles/:id/claim-prize
```

**Marketplace:**
```typescript
// GET /api/marketplace?type=resale&sort=price_asc
// GET /api/marketplace/:listing_id
// POST /api/marketplace/list
// POST /api/marketplace/:listing_id/purchase
// DELETE /api/marketplace/:listing_id
```

**Companies:**
```typescript
// GET /api/companies
// GET /api/companies/:id
// GET /api/companies/:id/raffles
```

**Users:**
```typescript
// GET /api/users/:wallet/raffles
// GET /api/users/:wallet/wins
// GET /api/users/:wallet/listings
// GET /api/users/:wallet/stats
```

#### 2.3 Example Implementation

**`app/api/raffles/route.ts` (Next.js)**
```typescript
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'active'
  const sort = searchParams.get('sort') || 'created_at'
  
  let query = supabase
    .from('raffles')
    .select('*')
    .eq('status', status)
  
  if (sort === 'ending_soon') {
    query = query
      .gt('end_time', new Date().toISOString())
      .order('end_time', { ascending: true })
      .limit(20)
  }
  
  const { data, error } = await query
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  
  return Response.json({ raffles: data })
}
```

**`app/api/raffles/[id]/buy-tickets/route.ts`**
```typescript
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Connection, PublicKey } from '@solana/web3.js'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { wallet_address, ticket_count } = await req.json()
  
  // 1. Verify raffle exists and is active
  const { data: raffle } = await supabase
    .from('raffles')
    .select('*')
    .eq('raffle_id', params.id)
    .single()
  
  if (!raffle || raffle.status !== 'active') {
    return Response.json({ error: 'Raffle not active' }, { status: 400 })
  }
  
  // 2. Check tickets available
  if (raffle.tickets_remaining < ticket_count) {
    return Response.json({ error: 'Not enough tickets' }, { status: 400 })
  }
  
  // 3. Generate ticket numbers
  const ticketNumbers = []
  let nextTicket = raffle.tickets_sold + 1
  for (let i = 0; i < ticket_count; i++) {
    ticketNumbers.push(nextTicket++)
  }
  
  // 4. Call Solana program to buy tickets
  // ... Solana transaction logic here
  
  // 5. Update database
  const { error } = await supabase
    .from('raffle_participants')
    .upsert({
      raffle_id: params.id,
      wallet_address,
      tickets_count: ticket_count,
      ticket_numbers: ticketNumbers,
      total_spent_moga: raffle.ticket_price_moga * ticket_count
    })
  
  return Response.json({ 
    success: true,
    ticket_numbers: ticketNumbers 
  })
}
```

---

### Phase 3: Solana Integration (Week 3-4)

#### 3.1 Program Calls

**Buy Raffle Tickets:**
```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { RwaRaffle } from './idl/rwa_raffle'

async function buyRaffleTickets(
  rafflePda: PublicKey,
  buyer: PublicKey,
  ticketCount: number
) {
  const program = new Program<RwaRaffle>(IDL, PROGRAM_ID, provider)
  
  const tx = await program.methods
    .buyTickets(ticketCount)
    .accounts({
      raffle: rafflePda,
      buyer,
      escrowAccount: escrowPda,
      mogaTokenMint: MOGA_MINT,
      buyerTokenAccount: buyerAta,
      escrowTokenAccount: escrowAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc()
  
  return tx
}
```

**Claim Prize:**
```typescript
async function claimPrize(
  rafflePda: PublicKey,
  winner: PublicKey,
  nftMint: PublicKey
) {
  const program = new Program<RwaRaffle>(IDL, PROGRAM_ID, provider)
  
  const tx = await program.methods
    .claimPrize()
    .accounts({
      raffle: rafflePda,
      winner,
      nftMint,
      winnerNftAccount: winnerAta,
      escrowNftAccount: escrowNftAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc()
  
  return tx
}
```

**Direct Sell:**
```typescript
async function listForSale(
  nftMint: PublicKey,
  seller: PublicKey,
  priceInMoga: number
) {
  const program = new Program<DirectSell>(IDL, PROGRAM_ID, provider)
  
  const tx = await program.methods
    .listNft(new BN(priceInMoga * 1e9))
    .accounts({
      listing: listingPda,
      seller,
      nftMint,
      sellerNftAccount: sellerAta,
      escrowNftAccount: escrowAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc()
  
  return tx
}
```

---

### Phase 4: Frontend (Week 4-6)

#### 4.1 Tech Stack
- **Framework:** Next.js 14 + TypeScript
- **Styling:** TailwindCSS + shadcn/ui
- **Wallet:** @solana/wallet-adapter-react
- **State:** Zustand or React Query
- **Icons:** Lucide React

#### 4.2 Key Pages

**Home Page (`/`)**
```typescript
// Carousels:
// 1. Featured Raffles
// 2. Ending Soon
// 3. Recently Completed
// 4. Batch Raffles
// 5. Hot Marketplace Deals
```

**Raffle Detail (`/raffle/[id]`)**
```typescript
// - NFT image & details
// - Countdown timer
// - Tickets sold progress bar
// - Buy tickets form
// - Participants list
// - Company info
```

**Marketplace (`/marketplace`)**
```typescript
// - Filters (category, price, type)
// - Grid of listings
// - Sort (price, newest, ending soon)
// - Quick buy button
```

**User Dashboard (`/dashboard`)**
```typescript
// Tabs:
// - My Tickets (active raffles)
// - My Wins (won NFTs)
// - My Listings (marketplace)
// - Transaction History
```

**Company Profile (`/company/[id]`)**
```typescript
// - Company info & verification badge
// - Stats (total raffles, volume, rating)
// - Active raffles
// - Collections
// - Reviews
```

#### 4.3 Example Component

**`components/RaffleCard.tsx`**
```typescript
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Clock, Users, Ticket } from 'lucide-react'

export function RaffleCard({ raffle }) {
  const progress = (raffle.tickets_sold / raffle.total_tickets) * 100
  const timeRemaining = calculateTimeRemaining(raffle.end_time)
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition">
      <div className="relative">
        <img 
          src={raffle.nft_image} 
          alt={raffle.nft_name}
          className="w-full h-48 object-cover"
        />
        {raffle.featured && (
          <Badge className="absolute top-2 right-2">Featured</Badge>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2">{raffle.nft_name}</h3>
        
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Clock className="w-4 h-4" />
          <span>{timeRemaining}</span>
        </div>
        
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span>{raffle.tickets_sold} / {raffle.total_tickets}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} />
        </div>
        
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">Ticket Price</p>
            <p className="font-bold">{raffle.ticket_price_moga} MOGA</p>
          </div>
          <Button>Buy Tickets</Button>
        </div>
      </div>
    </Card>
  )
}
```

---

### Phase 5: Cron Jobs & Background Tasks (Week 5)

#### 5.1 Tasks Needed

**1. Update Raffle Status**
```typescript
// Every minute
// Check if raffles have ended
// Update status from 'active' to 'completed'
```

**2. Select Winners**
```typescript
// When raffle ends
// Use VRF to select random ticket number
// Update winner in database
// Send notification
```

**3. Activate Next Batch**
```typescript
// When batch raffle completes
// Activate next batch in sequence
// Update batch_raffle_items status
```

**4. Expire Listings**
```typescript
// Every hour
// Check if listings have expired
// Update status to 'expired'
```

**5. Update Stats**
```typescript
// Every hour
// Update company stats (total_raffles, volume)
// Update user stats (wins, spent)
```

#### 5.2 Implementation (Vercel Cron)

**`app/api/cron/update-raffles/route.ts`**
```typescript
export async function GET() {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Find ended raffles
  const { data: endedRaffles } = await supabase
    .from('raffles')
    .select('*')
    .eq('status', 'active')
    .lt('end_time', new Date().toISOString())
  
  // Update each raffle
  for (const raffle of endedRaffles) {
    // Select winner using VRF
    const winningTicket = await selectWinner(raffle.raffle_id)
    
    // Update database
    await supabase
      .from('raffles')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        winner_wallet: winningTicket.wallet,
        winning_ticket_number: winningTicket.number
      })
      .eq('raffle_id', raffle.raffle_id)
  }
  
  return Response.json({ updated: endedRaffles.length })
}
```

**`vercel.json`**
```json
{
  "crons": [
    {
      "path": "/api/cron/update-raffles",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/activate-batches",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/expire-listings",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## 🎯 Testing Checklist

### Backend
- [ ] All API endpoints return correct data
- [ ] Pagination works
- [ ] Filters work (status, category, price)
- [ ] Sorting works
- [ ] Error handling (404, 500)
- [ ] Rate limiting

### Solana Integration
- [ ] Buy tickets transaction succeeds
- [ ] Claim prize transaction succeeds
- [ ] List NFT transaction succeeds
- [ ] Buy NFT transaction succeeds
- [ ] Escrow accounts work correctly
- [ ] VRF winner selection works

### Frontend
- [ ] All pages render correctly
- [ ] Wallet connection works
- [ ] Transactions sign and confirm
- [ ] Real-time updates (tickets sold)
- [ ] Countdown timers accurate
- [ ] Responsive design (mobile/desktop)
- [ ] Loading states
- [ ] Error messages

### Cron Jobs
- [ ] Raffles auto-complete on time
- [ ] Winners selected correctly
- [ ] Batch raffles auto-activate
- [ ] Listings auto-expire
- [ ] Stats update correctly

---

## 📊 Monitoring & Analytics

### Metrics to Track
- Total raffles created
- Total tickets sold
- Total volume (USD/MOGA)
- Active users
- Conversion rate (visitors → ticket buyers)
- Average tickets per user
- Marketplace sales
- Company performance

### Tools
- **Analytics:** Vercel Analytics or Google Analytics
- **Monitoring:** Sentry for errors
- **Database:** Supabase Dashboard
- **Blockchain:** Solana Explorer

---

## 🚀 Launch Plan

### Week 1-2: MVP
- Database + API
- Basic raffle listing
- Buy tickets functionality

### Week 3-4: Core Features
- Claim prizes
- Marketplace
- User dashboard

### Week 5-6: Polish
- Batch raffles
- Cron jobs
- Admin dashboard

### Week 7: Testing
- QA testing
- Bug fixes
- Performance optimization

### Week 8: Launch
- Deploy to production
- Onboard first companies
- Marketing push

---

## 📝 Next Immediate Steps

1. **Set up Supabase project**
2. **Run database schema**
3. **Seed mock data**
4. **Create Next.js project**
5. **Build first API endpoint** (`GET /api/raffles`)
6. **Build first page** (Home with raffle list)
7. **Integrate wallet connection**
8. **Test buy tickets flow**

---

## 🎉 You're Ready!

You now have:
- ✅ Complete database schema
- ✅ Mock data for 3 companies, 20+ raffles, 6 listings
- ✅ API structure
- ✅ Solana integration examples
- ✅ Frontend component examples
- ✅ Cron job setup
- ✅ Testing checklist
- ✅ Launch plan

**Start building! 🚀**

---

Generated: 2025-11-15
