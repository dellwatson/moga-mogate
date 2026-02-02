use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub refund_fee_bps: u16,
}

impl Config {
    pub const LEN: usize = 8 + 32 + 2;
}
