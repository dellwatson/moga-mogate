use anchor_lang::prelude::*;
use crate::constants::{MAX_RAFFLE_ID_LEN, MAX_URI_LEN};

#[account]
pub struct Raffle {
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
    pub bump: u8,
}

impl Raffle {
    pub const LEN: usize =
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
        1 + 1;                  // claimed, bump
}
