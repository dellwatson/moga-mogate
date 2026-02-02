use anchor_lang::prelude::*;
use crate::state::{Config, Raffle};
use crate::error::RaffleError;

pub const RAFFLE_SEED: &[u8] = b"raffle";
pub const TREASURY_SEED: &[u8] = b"treasury";

#[derive(Accounts)]
pub struct WithdrawProceeds<'info> {
    pub admin: Signer<'info>,
    pub config: Account<'info, Config>,
    pub raffle: Account<'info, Raffle>,
    
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    
    /// CHECK: arbitrary recipient
    #[account(mut)]
    pub to: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawProceeds>, amount: u64) -> Result<()> {
    // TODO: Implement withdraw logic
    msg!("Withdraw proceeds (TODO)");
    err!(RaffleError::NotImplemented)
}
