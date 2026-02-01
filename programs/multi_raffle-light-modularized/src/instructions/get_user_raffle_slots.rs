use anchor_lang::prelude::*;
use crate::state::{Raffle, UserRaffle};

pub const RAFFLE_SEED: &[u8] = b"raffle";
pub const USER_SEED: &[u8] = b"user";

#[derive(Accounts)]
pub struct GetUserRaffleSlots<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    
    #[account(seeds = [USER_SEED, raffle.key().as_ref(), user.key().as_ref()], bump)]
    pub user_raffle: Account<'info, UserRaffle>,
    
    /// CHECK: User pubkey for PDA derivation
    pub user: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<GetUserRaffleSlots>) -> Result<Vec<u32>> {
    let user_raffle = &ctx.accounts.user_raffle;
    Ok(user_raffle.slots.clone())
}
