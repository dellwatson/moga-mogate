use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::state::{Raffle, UserRaffle};
use crate::constants::{RAFFLE_SEED, USER_SEED, TREASURY_SEED};

#[derive(Accounts)]
pub struct WithdrawPrize<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    #[account(seeds = [USER_SEED, raffle.key().as_ref(), winner.key().as_ref()], bump)]
    pub user_raffle: Account<'info, UserRaffle>,

    /// CHECK: Treasury PDA
    #[account(
        mut,
        seeds = [TREASURY_SEED, raffle.key().as_ref()],
        bump
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawPrize>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let user_raffle = &ctx.accounts.user_raffle;

    require!(user_raffle.is_winner_handle != 0, crate::error::RaffleError::NotWinner);
    require!(!raffle.claimed, crate::error::RaffleError::AlreadyClaimed);

    let prize_amount = ctx.accounts.treasury.lamports();
    require!(prize_amount > 0, crate::error::RaffleError::NoFunds);

    let raffle_key = raffle.key();
    let treasury_seeds: &[&[&[u8]]] = &[
        &[TREASURY_SEED, raffle_key.as_ref(), &[ctx.bumps.treasury]],
    ];

    let transfer_cpi = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.winner.to_account_info(),
        },
        treasury_seeds,
    );
    system_program::transfer(transfer_cpi, prize_amount)?;

    raffle.claimed = true;

    msg!("Prize withdrawn: {} lamports!", prize_amount);
    Ok(())
}
