use anchor_lang::prelude::*;
use crate::state::{Config, Raffle, UserRaffle};
use crate::error::RaffleError;

pub const RAFFLE_SEED: &[u8] = b"raffle";
pub const USER_SEED: &[u8] = b"user";
pub const TREASURY_SEED: &[u8] = b"treasury";

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    pub config: Account<'info, Config>,
    
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    
    #[account(
        mut,
        seeds = [USER_SEED, raffle.key().as_ref(), caller.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,
    
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimRefund>) -> Result<()> {
    // TODO: Implement refund logic
    msg!("Claim refund (TODO)");
    err!(RaffleError::NotImplemented)
}
