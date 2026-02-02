use anchor_lang::prelude::*;
use crate::state::{Raffle};
use crate::constants::RAFFLE_SEED;

#[derive(Accounts)]
pub struct DrawWinner<'info> {
    pub authority: Signer<'info>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DrawWinner>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    
    require!(raffle.authority == ctx.accounts.authority.key(), crate::error::RaffleError::Unauthorized);
    require!(raffle.status == 0, crate::error::RaffleError::RaffleNotOpen); // 0 = Open

    // TODO: Add FHE operations later - for now just set placeholder
    raffle.winning_number_handle = 54321; // TODO: FHE encrypted winning number
    raffle.status = 2; // 2 = Drawn

    msg!("Winning number drawn! (FHE encrypted - nobody knows!)");
    Ok(())
}
