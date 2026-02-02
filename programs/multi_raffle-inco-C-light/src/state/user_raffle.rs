use anchor_lang::prelude::*;

/// UserRaffle - tracks user participation in raffles
/// Individual tickets are stored in Light Protocol compressed accounts
#[account]
pub struct UserRaffle {
    pub raffle: Pubkey,
    pub user: Pubkey,
    pub ticket_count: u32,
    pub number_handle: u128,  // TODO: FHE auto-assigned encrypted number
    pub is_winner_handle: u128,  // TODO: FHE encrypted boolean result
    pub bump: u8,
}

impl UserRaffle {
    pub const LEN: usize = 8 + 32 + 32 + 4 + 16 + 16 + 1;
}
