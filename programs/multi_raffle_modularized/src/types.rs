use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MultiRaffleStatus {
    Open = 0,
    Filled = 1,
    Drawn = 2,
    Cancelled = 3,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PrizeTokenType {
    None = 0,
    Spl = 1,           // Standard SPL token (NFT with Metaplex metadata)
    Cnft = 2,          // Compressed NFT (Metaplex Bubblegum)
    Pnft = 3,          // Programmable NFT (Metaplex Token Standard with rule sets)
    ZkCompressed = 4,  // ZK-compressed token (Light Protocol)
}

pub fn status_to_string(status: u8) -> String {
    if status == MultiRaffleStatus::Open as u8 {
        "OPEN".to_string()
    } else if status == MultiRaffleStatus::Filled as u8 {
        "FILLED".to_string()
    } else if status == MultiRaffleStatus::Drawn as u8 {
        "DRAWN".to_string()
    } else {
        "CANCELLED".to_string()
    }
}

pub fn prize_type_to_string(prize_type: u8) -> String {
    if prize_type == PrizeTokenType::Spl as u8 {
        "SPL".to_string()
    } else if prize_type == PrizeTokenType::Cnft as u8 {
        "cNFT".to_string()
    } else if prize_type == PrizeTokenType::Pnft as u8 {
        "pNFT".to_string()
    } else if prize_type == PrizeTokenType::ZkCompressed as u8 {
        "ZK_COMPRESSED".to_string()
    } else {
        "NONE".to_string()
    }
}

// View return types
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RaffleDetailView {
    pub total_slots: u32,
    pub sold_slots: u32,
    pub max_slots_per_address: u32,
    pub metadata_uri: String,
    pub collection: Pubkey,
    pub premint_contract: bool,
    pub premint: bool,
    pub auto_draw: bool,
    pub auto_claim: bool,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: u8,
    pub status_string: String,
    pub winner_slot: u32,
    pub winner: Pubkey,
    pub prize_amount: u64,
    pub prize_type: u8,
    pub prize_type_string: String,
    pub claimed: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RefundStatusView {
    pub paid: u64,
    pub refundable_amount: u64,
    pub expired: bool,
    pub can_claim: bool,
    pub status: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RaffleResultView {
    pub winner_slot: u32,
    pub winner: Pubkey,
    pub status: u8,
    pub status_string: String,
    pub claimed: bool,
    pub collection: Pubkey,
    pub prize_amount: u64,
    pub prize_type: u8,
    pub prize_type_string: String,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RafflesLoadView {
    pub total_slots: Vec<u32>,
    pub sold_slots: Vec<u32>,
    pub status: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RafflesLoadDetailView {
    pub total_slots: Vec<u32>,
    pub sold_slots: Vec<u32>,
    pub max_slots_per_address: Vec<u32>,
    pub metadata_uri: Vec<String>,
    pub collection: Vec<Pubkey>,
    pub premint_contract: Vec<bool>,
    pub premint: Vec<bool>,
    pub auto_draw: Vec<bool>,
    pub auto_claim: Vec<bool>,
    pub created_at: Vec<i64>,
    pub expires_at: Vec<i64>,
    pub status: Vec<u8>,
    pub winner_slot: Vec<u32>,
    pub winner: Vec<Pubkey>,
    pub prize_amount: Vec<u64>,
    pub prize_type: Vec<u8>,
    pub claimed: Vec<bool>,
}
