use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::constants::{RAFFLE_SEED, TREASURY_SEED};
use crate::error::RaffleError;
use crate::state::Raffle;
use crate::types::MultiRaffleStatus;

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    /// CHECK: treasury PDA
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(
        raffle.status == MultiRaffleStatus::WinnerIdentified as u8,
        RaffleError::BadStatus
    );
    require!(raffle.winner == ctx.accounts.caller.key(), RaffleError::NotWinner);
    require!(!raffle.claimed, RaffleError::AlreadyClaimed);

    raffle.claimed = true;
    raffle.status = MultiRaffleStatus::Claimed as u8;

    // Transfer prize from treasury to winner if any
    if raffle.prize_amount > 0 {
        let raffle_key = raffle.key();
        let (_, bump) = Pubkey::find_program_address(
            &[TREASURY_SEED, raffle_key.as_ref()],
            ctx.program_id,
        );
        let seeds: &[&[u8]] = &[TREASURY_SEED, raffle_key.as_ref(), &[bump]];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.caller.to_account_info(),
            },
            signer_seeds,
        );
        system_program::transfer(transfer_ctx, raffle.prize_amount)?;
    }

    msg!("Prize claimed by {}", ctx.accounts.caller.key());
    Ok(())
}
