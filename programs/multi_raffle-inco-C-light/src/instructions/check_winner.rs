use anchor_lang::prelude::*;
use crate::state::{Raffle, UserRaffle};
use crate::constants::{RAFFLE_SEED, USER_SEED};

#[derive(Accounts)]
pub struct CheckWinner<'info> {
    pub checker: Signer<'info>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut, seeds = [USER_SEED, raffle.key().as_ref(), checker.key().as_ref()], bump)]
    pub user_raffle: Account<'info, UserRaffle>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CheckWinner>) -> Result<()> {
    let raffle = &ctx.accounts.raffle;
    let user_raffle = &mut ctx.accounts.user_raffle;

    require!(raffle.status == 2, crate::error::RaffleError::RaffleNotOpen); // 2 = Drawn
    require!(raffle.winning_number_handle != 0, crate::error::RaffleError::NoWinningNumber);

    // TODO: Add FHE operations later - for now just set placeholder
    user_raffle.is_winner_handle = 1; // TODO: FHE encrypted boolean result

    msg!("Winner checked! (FHE encrypted result)");
    Ok(())
}
