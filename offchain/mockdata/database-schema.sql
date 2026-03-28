-- RWA Raffle & Direct-Sell Platform Database Schema
-- PostgreSQL / Supabase compatible

-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================
CREATE TABLE companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    legal_name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    country VARCHAR(2) NOT NULL,
    
    -- Registration
    registration_country VARCHAR(2),
    registration_number VARCHAR(100),
    registration_state VARCHAR(50),
    incorporation_date DATE,
    
    description TEXT,
    kyc_level VARCHAR(50) NOT NULL,
    kyc_documents JSONB,
    
    wallet_address VARCHAR(100) UNIQUE NOT NULL,
    collections JSONB, -- Array of collection objects
    
    -- Contact
    contact_email VARCHAR(100),
    contact_phone VARCHAR(50),
    support_email VARCHAR(100),
    
    -- Socials
    socials JSONB,
    
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    
    -- Stats
    total_raffles_created INTEGER DEFAULT 0,
    total_volume_usd DECIMAL(15, 2) DEFAULT 0,
    rating DECIMAL(2, 1),
    total_reviews INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_verified ON companies(verified);
CREATE INDEX idx_companies_wallet ON companies(wallet_address);

-- ============================================================================
-- RAFFLES TABLE
-- ============================================================================
CREATE TABLE raffles (
    raffle_id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'single', 'batch'
    status VARCHAR(20) NOT NULL, -- 'active', 'completed', 'cancelled'
    
    -- NFT Details
    nft_mint_address VARCHAR(100) UNIQUE NOT NULL,
    nft_metadata_uri TEXT NOT NULL,
    nft_name VARCHAR(200) NOT NULL,
    nft_image TEXT NOT NULL,
    nft_collection_address VARCHAR(100) NOT NULL,
    nft_supply INTEGER DEFAULT 1,
    
    -- Creator
    company_id VARCHAR(50) REFERENCES companies(id),
    company_name VARCHAR(100),
    creator_wallet VARCHAR(100) NOT NULL,
    
    -- Pricing
    estimated_value_usd DECIMAL(15, 2) NOT NULL,
    ticket_price_moga DECIMAL(10, 2) NOT NULL,
    total_tickets INTEGER NOT NULL,
    tickets_sold INTEGER DEFAULT 0,
    tickets_remaining INTEGER,
    total_pot_moga DECIMAL(15, 2),
    total_pot_usd DECIMAL(15, 2),
    
    -- Timeline
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration_days INTEGER,
    
    -- Winner
    winner_wallet VARCHAR(100),
    winning_ticket_number INTEGER,
    winner_tickets_owned INTEGER,
    winner_claimed BOOLEAN DEFAULT false,
    winner_claimed_at TIMESTAMP,
    
    -- Program Data
    raffle_pda VARCHAR(100) UNIQUE NOT NULL,
    escrow_account VARCHAR(100) NOT NULL,
    program_id VARCHAR(100) NOT NULL,
    
    -- Metadata
    featured BOOLEAN DEFAULT false,
    category VARCHAR(50),
    tags TEXT[],
    views INTEGER DEFAULT 0,
    favorites INTEGER DEFAULT 0,
    result_type VARCHAR(50), -- 'max_tickets_reached', 'time_expired_partial'
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_raffles_status ON raffles(status);
CREATE INDEX idx_raffles_end_time ON raffles(end_time);
CREATE INDEX idx_raffles_company ON raffles(company_id);
CREATE INDEX idx_raffles_featured ON raffles(featured);
CREATE INDEX idx_raffles_category ON raffles(category);
CREATE INDEX idx_raffles_winner ON raffles(winner_wallet);

-- ============================================================================
-- BATCH RAFFLES TABLE
-- ============================================================================
CREATE TABLE batch_raffles (
    batch_raffle_id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'batch', 'batch_mixed'
    status VARCHAR(20) NOT NULL,
    
    -- Batch Config
    total_batches INTEGER NOT NULL,
    current_batch INTEGER DEFAULT 1,
    completed_batches INTEGER DEFAULT 0,
    nft_per_batch INTEGER DEFAULT 1,
    same_nft_type BOOLEAN DEFAULT true,
    
    -- Creator
    company_id VARCHAR(50) REFERENCES companies(id),
    company_name VARCHAR(100),
    creator_wallet VARCHAR(100) NOT NULL,
    
    -- NFT Template (for same type batches)
    nft_template_metadata_uri TEXT,
    nft_template_name VARCHAR(200),
    nft_template_image TEXT,
    nft_collection_address VARCHAR(100),
    
    -- Pricing
    estimated_value_per_nft_usd DECIMAL(15, 2),
    ticket_price_moga DECIMAL(10, 2),
    tickets_per_batch INTEGER,
    total_pot_per_batch_moga DECIMAL(15, 2),
    
    -- Program Data
    batch_raffle_pda VARCHAR(100) UNIQUE NOT NULL,
    program_id VARCHAR(100) NOT NULL,
    
    -- Metadata
    featured BOOLEAN DEFAULT false,
    category VARCHAR(50),
    tags TEXT[],
    views INTEGER DEFAULT 0,
    favorites INTEGER DEFAULT 0,
    description TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_batch_raffles_status ON batch_raffles(status);
CREATE INDEX idx_batch_raffles_company ON batch_raffles(company_id);

-- ============================================================================
-- BATCH RAFFLE ITEMS TABLE
-- ============================================================================
CREATE TABLE batch_raffle_items (
    id SERIAL PRIMARY KEY,
    batch_raffle_id VARCHAR(50) REFERENCES batch_raffles(batch_raffle_id),
    batch_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'active', 'completed'
    
    -- NFT Details (for mixed batches)
    nft_mint_address VARCHAR(100),
    nft_metadata_uri TEXT,
    nft_name VARCHAR(200),
    nft_image TEXT,
    estimated_value_usd DECIMAL(15, 2),
    
    -- Pricing
    ticket_price_moga DECIMAL(10, 2),
    total_tickets INTEGER,
    tickets_sold INTEGER DEFAULT 0,
    tickets_remaining INTEGER,
    total_pot_moga DECIMAL(15, 2),
    
    -- Timeline
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Winner
    winner_wallet VARCHAR(100),
    winning_ticket_number INTEGER,
    winner_claimed BOOLEAN DEFAULT false,
    winner_claimed_at TIMESTAMP,
    
    -- Program Data
    raffle_pda VARCHAR(100),
    escrow_account VARCHAR(100),
    
    participants_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(batch_raffle_id, batch_number)
);

CREATE INDEX idx_batch_items_batch_raffle ON batch_raffle_items(batch_raffle_id);
CREATE INDEX idx_batch_items_status ON batch_raffle_items(status);

-- ============================================================================
-- RAFFLE PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE raffle_participants (
    id SERIAL PRIMARY KEY,
    raffle_id VARCHAR(50) REFERENCES raffles(raffle_id),
    wallet_address VARCHAR(100) NOT NULL,
    tickets_count INTEGER NOT NULL,
    ticket_numbers INTEGER[] NOT NULL,
    total_spent_moga DECIMAL(10, 2) NOT NULL,
    
    participated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(raffle_id, wallet_address)
);

CREATE INDEX idx_participants_raffle ON raffle_participants(raffle_id);
CREATE INDEX idx_participants_wallet ON raffle_participants(wallet_address);

-- ============================================================================
-- DIRECT SELL LISTINGS TABLE
-- ============================================================================
CREATE TABLE direct_sell_listings (
    listing_id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'resale', 'direct_from_company'
    status VARCHAR(20) NOT NULL, -- 'active', 'sold', 'cancelled', 'expired'
    
    -- NFT Details
    nft_mint_address VARCHAR(100) NOT NULL,
    nft_metadata_uri TEXT NOT NULL,
    nft_name VARCHAR(200) NOT NULL,
    nft_image TEXT NOT NULL,
    nft_collection_address VARCHAR(100) NOT NULL,
    nft_supply INTEGER DEFAULT 1,
    
    -- Seller
    seller_wallet VARCHAR(100) NOT NULL,
    seller_username VARCHAR(100),
    seller_verified BOOLEAN DEFAULT false,
    seller_rating DECIMAL(2, 1),
    seller_total_sales INTEGER DEFAULT 0,
    
    -- Company (if direct sale)
    company_id VARCHAR(50) REFERENCES companies(id),
    
    -- Buyer (if sold)
    buyer_wallet VARCHAR(100),
    buyer_username VARCHAR(100),
    
    -- Original Raffle (for resales)
    original_raffle_id VARCHAR(50),
    won_at TIMESTAMP,
    winning_ticket_number INTEGER,
    tickets_owned INTEGER,
    total_spent_moga DECIMAL(10, 2),
    
    -- Pricing
    estimated_value_usd DECIMAL(15, 2) NOT NULL,
    listing_price_usd DECIMAL(15, 2) NOT NULL,
    listing_price_moga DECIMAL(15, 2) NOT NULL,
    sold_price_moga DECIMAL(15, 2),
    discount_percentage DECIMAL(5, 2),
    original_cost_moga DECIMAL(10, 2),
    profit_potential_moga DECIMAL(10, 2),
    
    -- Timeline
    listed_at TIMESTAMP DEFAULT NOW(),
    sold_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    time_to_sell_hours INTEGER,
    
    -- Program Data
    listing_pda VARCHAR(100) UNIQUE NOT NULL,
    escrow_account VARCHAR(100) NOT NULL,
    program_id VARCHAR(100) NOT NULL,
    
    -- Metadata
    featured BOOLEAN DEFAULT false,
    category VARCHAR(50),
    tags TEXT[],
    views INTEGER DEFAULT 0,
    favorites INTEGER DEFAULT 0,
    reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_listings_status ON direct_sell_listings(status);
CREATE INDEX idx_listings_seller ON direct_sell_listings(seller_wallet);
CREATE INDEX idx_listings_buyer ON direct_sell_listings(buyer_wallet);
CREATE INDEX idx_listings_type ON direct_sell_listings(type);
CREATE INDEX idx_listings_price ON direct_sell_listings(listing_price_usd);
CREATE INDEX idx_listings_category ON direct_sell_listings(category);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    wallet_address VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(100),
    
    verified BOOLEAN DEFAULT false,
    kyc_level VARCHAR(50),
    
    -- Stats
    total_raffles_participated INTEGER DEFAULT 0,
    total_raffles_won INTEGER DEFAULT 0,
    total_spent_moga DECIMAL(15, 2) DEFAULT 0,
    total_winnings_value_usd DECIMAL(15, 2) DEFAULT 0,
    
    -- Marketplace Stats
    total_listings INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    seller_rating DECIMAL(2, 1),
    buyer_rating DECIMAL(2, 1),
    
    -- Preferences
    favorite_categories TEXT[],
    notification_preferences JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_verified ON users(verified);

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE transactions (
    tx_id SERIAL PRIMARY KEY,
    tx_signature VARCHAR(100) UNIQUE NOT NULL,
    tx_type VARCHAR(50) NOT NULL, -- 'buy_tickets', 'claim_prize', 'list_nft', 'buy_nft', 'cancel_listing'
    
    wallet_address VARCHAR(100) NOT NULL,
    
    -- Related entities
    raffle_id VARCHAR(50),
    listing_id VARCHAR(50),
    
    amount_moga DECIMAL(15, 2),
    amount_usd DECIMAL(15, 2),
    
    status VARCHAR(20) NOT NULL, -- 'pending', 'confirmed', 'failed'
    
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP
);

CREATE INDEX idx_transactions_wallet ON transactions(wallet_address);
CREATE INDEX idx_transactions_type ON transactions(tx_type);
CREATE INDEX idx_transactions_raffle ON transactions(raffle_id);
CREATE INDEX idx_transactions_listing ON transactions(listing_id);
CREATE INDEX idx_transactions_signature ON transactions(tx_signature);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active raffles ending soon
CREATE VIEW raffles_ending_soon AS
SELECT *
FROM raffles
WHERE status = 'active'
  AND end_time > NOW()
  AND end_time < NOW() + INTERVAL '3 days'
ORDER BY end_time ASC;

-- Hot marketplace deals
CREATE VIEW marketplace_hot_deals AS
SELECT *
FROM direct_sell_listings
WHERE status = 'active'
  AND discount_percentage > 50
ORDER BY discount_percentage DESC, views DESC;

-- User raffle history
CREATE VIEW user_raffle_history AS
SELECT 
    rp.wallet_address,
    r.raffle_id,
    r.nft_name,
    r.nft_image,
    rp.tickets_count,
    rp.total_spent_moga,
    r.status,
    r.winner_wallet,
    CASE WHEN r.winner_wallet = rp.wallet_address THEN true ELSE false END as is_winner
FROM raffle_participants rp
JOIN raffles r ON rp.raffle_id = r.raffle_id
ORDER BY rp.participated_at DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update raffle tickets remaining
CREATE OR REPLACE FUNCTION update_raffle_tickets()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE raffles
    SET 
        tickets_sold = NEW.tickets_sold,
        tickets_remaining = total_tickets - NEW.tickets_sold,
        total_pot_moga = ticket_price_moga * NEW.tickets_sold,
        updated_at = NOW()
    WHERE raffle_id = NEW.raffle_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update tickets
CREATE TRIGGER trigger_update_raffle_tickets
AFTER INSERT OR UPDATE ON raffle_participants
FOR EACH ROW
EXECUTE FUNCTION update_raffle_tickets();

-- ============================================================================
-- SEED DATA (Optional)
-- ============================================================================

-- Insert mock companies
-- (Use the data from companies.json)

-- Insert mock raffles
-- (Use the data from raffles-*.json)

-- Insert mock listings
-- (Use the data from direct-sell-listings.json)
