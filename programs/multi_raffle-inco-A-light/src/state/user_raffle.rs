use anchor_lang::prelude::*;

/// Per-user participation record (commit-reveal)
#[account]
pub struct UserRaffle {
    pub raffle: Pubkey,
    pub user: Pubkey,
    pub ticket_count: u32,
    pub paid: u64, // total lamports paid into this raffle
}

impl UserRaffle {
    pub const LEN: usize = 32 + 32 + 4 + 8; // raffle + user + ticket_count + paid
}
