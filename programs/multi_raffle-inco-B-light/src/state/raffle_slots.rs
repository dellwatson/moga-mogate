use anchor_lang::prelude::*;

/// RaffleSlots - metadata for ZK-compressed ticket storage
/// Actual ticket ownership is stored in Light Protocol compressed accounts
#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,              // 32 bytes - parent raffle
    pub total_tickets: u32,          // 4 bytes - total number of tickets
    pub sold_tickets: u32,           // 4 bytes - number of sold tickets
}

impl RaffleSlots {
    pub const LEN: usize = 8 + 32 + 4 + 4; // discriminator + fields
}
