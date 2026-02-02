use anchor_lang::prelude::*;

const MAX_RAFFLE_ID_LEN: usize = 64;
const MAX_URI_LEN: usize = 256;

#[account]
pub struct Raffle {
    pub raffle_id: String,
    pub authority: Pubkey,
    pub ticket_price: u64,
    pub max_number: u32,  // Range for user guesses (1-N)
    pub metadata_uri: String,
    pub collection: Pubkey,
    pub prize_type: u8,
    pub prize_amount: u64,
    pub prize_per_winner: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: u8,
    pub total_tickets: u32,
    pub total_winners: u32,
    pub winning_number_handle: u128,  // TODO: FHE encrypted winning number
    pub claimed: bool,
    pub bump: u8,
}

impl Raffle {
    pub const LEN: usize =
        8 +                     // discriminator
        4 + MAX_RAFFLE_ID_LEN + // raffle_id
        4 + MAX_URI_LEN +       // metadata_uri
        32 + 32 +               // authority, collection
        8 +                     // ticket_price
        4 +                     // max_number
        1 +                     // prize_type
        8 +                     // prize_amount
        8 +                     // prize_per_winner
        8 + 8 +                 // created_at, expires_at
        1 +                     // status
        4 +                     // total_tickets
        4 +                     // total_winners
        16 +                    // winning_number_handle
        1 + 1 +                 // claimed, bump
        32;                     // buffer
}
