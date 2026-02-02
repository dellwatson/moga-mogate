use anchor_lang::prelude::*;

pub const MAX_SLOTS_PER_USER: u32 = 1024;

/// Per-user participation record with FHE-encrypted slot ownership
#[account]
pub struct UserRaffle {
    pub raffle: Pubkey,
    pub user: Pubkey,
    pub slots_handle: u128, // FHE: encrypted slots ownership instead of plain Vec<u32>
    pub paid: u64,         // total lamports paid into this raffle
}

impl UserRaffle {
    pub const LEN: usize = 32 + 32 + 16 + 8; // raffle + user + slots_handle + paid
}
