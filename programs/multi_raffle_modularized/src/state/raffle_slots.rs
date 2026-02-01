use anchor_lang::prelude::*;

#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub total_slots: u32,
    pub slot_owners: Vec<Pubkey>, // length == total_slots, 1-based externally
}

impl RaffleSlots {
    pub fn space(total_slots: u32) -> usize {
        32 + // raffle
        4 +  // total_slots
        4 + (total_slots as usize) * 32 // vec len + owners
    }
}
