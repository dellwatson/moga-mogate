use anchor_lang::prelude::*;
use crate::constants::*;

#[account]
pub struct Raffle {
    pub authority: Pubkey,        // host / admin
    pub raffle_id: String,
    pub total_slots: u32,
    pub max_slots_per_address: u32,
    pub metadata_uri: String,
    pub collection: Pubkey,
    pub premint_contract: bool,
    pub premint: bool,
    pub auto_draw: bool,
    pub auto_claim: bool,
    pub prize_type: u8,
    pub prize_amount: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: u8,
    pub sold_slots: u32,
    pub winner_slot: u32,
    pub winner: Pubkey,
    pub claimed: bool,
    pub winning_slot_handle: u128, // FHE: encrypted winning slot (Inco Lightning)
    pub bump: u8,
}

impl Raffle {
    pub const LEN: usize =
        32 +                    // authority
        4 + MAX_RAFFLE_ID_LEN + // raffle_id
        4 + MAX_URI_LEN +       // metadata_uri
        4 +                     // total_slots
        4 +                     // max_slots_per_address
        32 +                    // collection
        1 + 1 + 1 + 1 +         // premint_contract, premint, auto_draw, auto_claim
        1 +                     // prize_type
        8 +                     // prize_amount
        8 + 8 +                 // created_at, expires_at
        1 +                     // status
        4 + 4 +                 // sold_slots, winner_slot
        32 +                    // winner
        1 + 16 + 1;             // claimed, winning_slot_handle, bump
}

pub fn status_to_string(status: u8) -> String {
    match status {
        0 => "OPEN".to_string(),
        1 => "FILLED".to_string(),
        2 => "WINNER_SLOT_PICKED".to_string(),
        3 => "WINNER_IDENTIFIED".to_string(),
        4 => "CLAIMED".to_string(),
        5 => "CANCELLED".to_string(),
        _ => "UNKNOWN".to_string(),
    }
}

pub fn prize_type_to_string(prize_type: u8) -> String {
    match prize_type {
        1 => "SPL".to_string(),
        2 => "cNFT".to_string(),
        3 => "pNFT".to_string(),
        4 => "ZK_COMPRESSED".to_string(),
        _ => "NONE".to_string(),
    }
}
