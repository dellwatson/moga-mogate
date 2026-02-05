use anchor_lang::prelude::*;
use light_sdk::LightDiscriminator;

/// Compressed slot stored in LIGHT zk-compressed state
/// Stores a commitment to the owner (commit-reveal)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, LightDiscriminator, Default)]
pub struct CompressedSlot {
    pub raffle: Pubkey,
    pub slot_id: u32,
    pub owner_commitment: [u8; 32],
}
