use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MultiRaffleStatus {
    Open = 0,
    Filled = 1,
    WinnerSlotPicked = 2,
    WinnerIdentified = 3,
    Claimed = 4,
    Cancelled = 5,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PrizeTokenType {
    None = 0,
    Spl = 1,
    Cnft = 2,
    Pnft = 3,
    ZkCompressed = 4,
}

// View types for frontend
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
pub struct RefundStatusView {
    pub paid: u64,
    pub refundable_amount: u64,
    pub expired: bool,
    pub can_claim: bool,
    pub status: u8,
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

pub fn status_to_string(status: u8) -> String {
    match status {
        0 => "Open".to_string(),
        1 => "Filled".to_string(),
        2 => "WinnerSlotPicked".to_string(),
        3 => "WinnerIdentified".to_string(),
        4 => "Claimed".to_string(),
        5 => "Cancelled".to_string(),
        _ => "Unknown".to_string(),
    }
}

pub fn prize_type_to_string(prize_type: u8) -> String {
    match prize_type {
        0 => "None".to_string(),
        1 => "SPL".to_string(),
        2 => "CNFT".to_string(),
        3 => "PNFT".to_string(),
        4 => "ZkCompressed".to_string(),
        _ => "Unknown".to_string(),
    }
}
