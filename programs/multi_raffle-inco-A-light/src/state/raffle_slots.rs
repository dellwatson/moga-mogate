use anchor_lang::prelude::*;

/// RaffleSlots - metadata for ZK-compressed slot storage
/// Actual slot ownership is stored in Light Protocol compressed accounts
#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,              // 32 bytes - parent raffle
    pub total_slots: u32,            // 4 bytes - total number of slots
    pub sold_slots: u32,             // 4 bytes - number of sold slots
    // Light protocol tree configuration
    pub address_tree: Pubkey,        // 32 bytes - address merkle tree
    pub address_queue: Pubkey,       // 32 bytes - address queue
    pub state_tree: Pubkey,          // 32 bytes - state merkle tree
    pub state_queue: Pubkey,         // 32 bytes - state queue
}

impl RaffleSlots {
    pub const LEN: usize = 8 + 32 + 4 + 4 + 32 + 32 + 32 + 32; // discriminator + fields
}
