use anchor_lang::prelude::*;

/// RaffleSlots - metadata for ZK-compressed slot storage
/// Actual slot ownership is stored in Light Protocol compressed accounts
#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,              // 32 bytes - parent raffle
    pub total_slots: u32,            // 4 bytes - total number of slots
    pub sold_slots: u32,             // 4 bytes - number of sold slots
}

impl RaffleSlots {
    pub const LEN: usize = 8 + 32 + 4 + 4; // discriminator + fields
}
