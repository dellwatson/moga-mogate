use anchor_lang::prelude::*;
use light_sdk::LightDiscriminator;

/// Compressed ticket stored in LIGHT zk-compressed state
/// This is the scalable representation of per-user slot ownership
#[derive(AnchorSerialize, AnchorDeserialize, Clone, LightDiscriminator, Default)]
pub struct CompressedTicket {
    pub raffle: Pubkey,
    pub user: Pubkey,
    pub slot_ids: Vec<u32>,
    pub amount: u64,
    pub created_at: i64,
}
