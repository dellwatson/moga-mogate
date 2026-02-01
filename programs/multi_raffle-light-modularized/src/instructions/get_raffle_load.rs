use anchor_lang::prelude::*;
use crate::state::Raffle;

pub const RAFFLE_SEED: &[u8] = b"raffle";

#[derive(Accounts)]
pub struct GetRaffleLoad<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
}

pub fn handler(ctx: Context<GetRaffleLoad>) -> Result<(u32, u32, u8)> {
    let raffle = &ctx.accounts.raffle;
    Ok((raffle.total_slots, raffle.sold_slots, raffle.status))
}
