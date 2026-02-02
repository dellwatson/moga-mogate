use anchor_lang::prelude::*;
use inco_lightning::types::Euint128;

const MAX_RAFFLE_ID_LEN: usize = 64;
const MAX_URI_LEN: usize = 256;
const MAX_SLOTS_PER_USER: u32 = 1024;

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
    Spl = 1,
    Cnft = 2,
    Pnft = 3,
    ZkCompressed = 4,
}

#[account]
pub struct Raffle {
    pub authority: Pubkey,
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
    pub winning_slot_handle: u128, // FHE: encrypted winning slot
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
        1 + 1 + 16 +            // claimed, bump, winning_slot_handle
        32;                     // extra buffer
}

#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub total_slots: u32,
    pub slot_owners: Vec<Pubkey>, // Public: which slots are taken (Pubkey::default() = available)
}

impl RaffleSlots {
    pub fn space(total_slots: u32) -> usize {
        32 + // raffle
        4 +  // total_slots
        4 + (total_slots as usize) * 32 // vec len + owners
    }
}

#[account]
pub struct UserRaffle {
    pub raffle: Pubkey,
    pub user: Pubkey,
    pub slots_handle: u128, // FHE: encrypted slots ownership (instead of plain Vec<u32>)
    pub paid: u64,
}

impl UserRaffle {
    pub const LEN: usize = 32 + 32 + 16 + 8; // raffle + user + slots_handle + paid
}

#[account]
pub struct Ticket {
    pub raffle: Pubkey,
    pub owner: Pubkey,
    pub guess_handle: u128, // FHE: encrypted guess
    pub is_winner_handle: u128, // FHE: encrypted winner status
    pub claimed: bool,
    pub bump: u8,
}

impl Ticket {
    pub const SIZE: usize = 32 + 32 + 16 + 16 + 1 + 1; // raffle + owner + guess + is_winner + claimed + bump
}
