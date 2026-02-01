use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub refund_fee_bps: u16, // e.g. 500 = 5%
}

impl Config {
    pub const LEN: usize = 32 + 2;
}
