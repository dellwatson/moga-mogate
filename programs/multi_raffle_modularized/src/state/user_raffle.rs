use anchor_lang::prelude::*;
use crate::constants::MAX_SLOTS_PER_USER;

#[account]
pub struct UserRaffle {
    pub raffle: Pubkey,
    pub user: Pubkey,
    pub slots: Vec<u32>,
    pub paid: u64, // total lamports paid into this raffle
}

impl UserRaffle {
    pub fn space() -> usize {
        32 + // raffle
        32 + // user
        4 + (MAX_SLOTS_PER_USER as usize) * 4 + // slots vec (u32)
        8 // paid
    }
}
